import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { EnumComparisonTest } from "../target/types/enum_comparison_test";
import { assert } from "chai";

/**
 * Unit Test: Enum Comparison Trait Missing Error
 * 
 * You're trying to compare enum values with ==, but Rust won't let you.
 * Why? Because Rust doesn't know how to compare your enum - you haven't given
 * it the "permission" (the PartialEq trait) to do so.
 * 
 * Think of it like this: you can't use gym equipment without a membership.
 * PartialEq is that membership card for the == operator. Without it, Rust
 * literally doesn't know what it means for two enum values to be equal.
 */
describe("enum-comparison-test", () => {
  anchor.setProvider(anchor.AnchorProvider.local());
  const program = anchor.workspace.EnumComparisonTest as Program<EnumComparisonTest>;

  it("Demonstrates enum comparison error and fix", async () => {
    const lottery = anchor.web3.Keypair.generate();
    const user = program.provider.wallet;

    // Step 1: Initialize lottery with Active status
    // This works fine - we're just setting the status, not comparing
    const initTx = await program.methods
      .initialize(new anchor.BN(1000))
      .accounts({
        lottery: lottery.publicKey,
        user: user.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([lottery])
      .rpc();

    console.log("✓ Initialized lottery:", initTx);

    // Step 2: Try to check status using == comparison
    // ERROR VERSION: This will fail to compile because LotteryStatus lacks PartialEq trait
    // The error message: "binary operation `==` cannot be applied to type `LotteryStatus`"
    //
    // What's happening? In lib.rs, the enum is defined as:
    // #[derive(Clone, AnchorSerialize, AnchorDeserialize)]  // Missing PartialEq!
    // 
    // When check_status tries to use:
    // lottery.status == LotteryStatus::Active  // Rust says "nope, can't do that"
    //
    // FIXED VERSION: After adding PartialEq and Eq traits:
    // #[derive(Clone, Copy, PartialEq, Eq, AnchorSerialize, AnchorDeserialize)]
    // Now Rust knows how to compare, so == works!
    
    try {
      const checkTx = await program.methods
        .checkStatus()
        .accounts({
          lottery: lottery.publicKey,
        })
        .rpc();

      console.log("✓ Status check successful:", checkTx);
      
      // Verify the transaction succeeded
      const txDetails = await program.provider.connection.getTransaction(checkTx, {
        commitment: "confirmed",
        maxSupportedTransactionVersion: 0,
      });
      
      assert.isNull(txDetails?.meta?.err, "Transaction should succeed with PartialEq trait");
      console.log("✓ Enum comparison works correctly with PartialEq trait!");
      
    } catch (error) {
      // If compilation failed, the error would be caught during build
      // This catch is for runtime errors only
      console.error("Runtime error:", error);
      throw error;
    }

    // What you learned:
    // 1. PartialEq = the "membership card" that lets you use == and !=
    // 2. Eq = says "equality makes sense here" (usually paired with PartialEq)
    // 3. Copy = lets Rust copy enum values cheaply (good for simple enums)
    // 4. If you'll compare enum values, add these traits from the start
  });
});

