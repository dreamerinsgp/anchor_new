import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SerializationLogTest } from "../target/types/serialization_log_test";
import { assert } from "chai";

describe("serialization-log-test", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.local());

  const program = anchor.workspace
    .SerializationLogTest as Program<SerializationLogTest>;

  it("Initializes account and logs serialization", async () => {
    const testAccount = anchor.web3.Keypair.generate();

    const tx = await program.methods
      .initialize(
        new anchor.BN(42),
        "Test Account Name",
        new anchor.BN(1000000)
      )
      .accounts({
        testAccount: testAccount.publicKey,
        user: program.provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([testAccount])
      .rpc();

    console.log("\n=== Transaction signature:", tx, "===");
    
    // Fetch and display transaction logs
    const txDetails = await program.provider.connection.getTransaction(tx, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });
    
    if (txDetails?.meta?.logMessages) {
      console.log("\n=== Program Logs (Initialization) ===");
      txDetails.meta.logMessages.forEach((log, index) => {
        console.log(`[${index}] ${log}`);
      });
    }
  });

  it("Updates account and logs field-by-field serialization", async () => {
    const testAccount = anchor.web3.Keypair.generate();

    // First initialize
     await program.methods
      .initialize(
        new anchor.BN(100),
        "Initial Name",
        new anchor.BN(5000000)
      )
      .accounts({
        testAccount: testAccount.publicKey,
        user: program.provider.wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([testAccount])
      .rpc();

    // // Then update
    const tx = await program.methods
      .update(
        1, // Completed status
        new anchor.BN(200),
        "Updated Name",
        false,
        new anchor.BN(10000000)
      )
      .accounts({
        testAccount: testAccount.publicKey,
      })
      .rpc();

    console.log("\n=== Update transaction signature:", tx, "===");
    
    // Wait a bit for transaction to be confirmed
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Fetch and display transaction logs
    const txDetails = await program.provider.connection.getTransaction(tx, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });
    
    if (!txDetails) {
      console.log("\n⚠️ Warning: Could not fetch transaction details. Transaction may still be processing.");
      return;
    }
    
    if (txDetails.meta?.err) {
      console.log("\n❌ Transaction failed with error:", txDetails.meta.err);
    }
    
    if (txDetails?.meta?.logMessages) {
      console.log("\n=== Program Logs (Field-by-Field Serialization) ===");
      txDetails.meta.logMessages.forEach((log, index) => {
        console.log(`[${index}] ${log}`);
      });
    } else {
      console.log("\n⚠️ Warning: No log messages found in transaction.");
      console.log("Transaction details:", JSON.stringify(txDetails.meta, null, 2));
    }
  });
});

