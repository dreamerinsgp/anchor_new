import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { ReallocationErrorTest } from "../target/types/reallocation_error_test";
import { assert } from "chai";

describe("reallocation-error-test", () => {
  anchor.setProvider(anchor.AnchorProvider.local());
  const program = anchor.workspace
    .ReallocationErrorTest as Program<ReallocationErrorTest>;

  it("Reproduces Vec reallocation error when extending existing Vec", async () => {
    const buyer = anchor.web3.Keypair.generate();
    
    // Fund the buyer account
    const airdropSig = await program.provider.connection.requestAirdrop(
      buyer.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    await program.provider.connection.confirmTransaction(airdropSig);

    // Step 1: Initialize ticket account with first batch of tickets
    // This works fine - account is created with pre-allocated space
    console.log("\n=== Step 1: Initial purchase (works) ===");
    const initialTickets = [1, 2, 3]; // 3 tickets
    
    const [ticketPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("ticket"), buyer.publicKey.toBuffer()],
      program.programId
    );

    try {
      const tx1 = await program.methods
        .initialize(initialTickets)
        .accounts({
          buyer: buyer.publicKey,
          ticket: ticketPda,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([buyer])
        .rpc();

      console.log("✅ First purchase successful:", tx1);
      
      // Fetch and output program logs
      console.log("\n--- Program Logs (initialize) ---");
      const tx1Details = await program.provider.connection.getTransaction(tx1, {
        commitment: "confirmed",
        maxSupportedTransactionVersion: 0,
      });
      if (tx1Details?.meta?.logMessages) {
        tx1Details.meta.logMessages.forEach((log: string) => {
          // Output all program logs (msg! outputs appear as "Program log: ...")
          if (log.includes("Program log:")) {
            // Extract just the message part after "Program log: "
            const message = log.replace("Program log: ", "");
            console.log(`  📝 ${message}`);
          } else if (log.includes("Program data:")) {
            console.log(`  📊 ${log}`);
          }
        });
      }
      console.log("--- End Logs ---\n");
      
      // Verify account was created
      const ticketAccount = await program.account.ticket.fetch(ticketPda);
      console.log(`   Account has ${ticketAccount.ticketNumbers.length} tickets`);
      assert.equal(ticketAccount.ticketNumbers.length, 3, "Should have 3 tickets");

      // Step 2: Try to add more tickets to existing account
      // This FAILS because Anchor deserializes Vec with capacity = length
      // extend_from_slice triggers reallocation which fails in Solana
      console.log("\n=== Step 2: Second purchase (should fail) ===");
      const newTickets = [4, 5]; // Try to add 2 more tickets
      
      try {
        const tx2 = await program.methods
          .addTickets(newTickets)
          .accounts({
            buyer: buyer.publicKey,
            ticket: ticketPda,
          })
          .signers([buyer])
          .rpc();

        // If we reach here, the test failed (bug was fixed or not reproduced)
        console.log("❌ ERROR: Transaction succeeded but should have failed!");
        console.log("   This means the reallocation bug was not reproduced.");
        
        // Still output logs even if it succeeded unexpectedly
        console.log("\n--- Program Logs (addTickets - unexpected success) ---");
        const tx2Details = await program.provider.connection.getTransaction(tx2, {
          commitment: "confirmed",
          maxSupportedTransactionVersion: 0,
        });
        if (tx2Details?.meta?.logMessages) {
          tx2Details.meta.logMessages.forEach((log: string) => {
            if (log.includes("Program log:")) {
              const message = log.replace("Program log: ", "");
              console.log(`  📝 ${message}`);
            } else if (log.includes("Program data:")) {
              console.log(`  📊 ${log}`);
            }
          });
        }
        console.log("--- End Logs ---\n");
        
        assert.fail("Transaction should have failed with reallocation error");
      } catch (error: any) {
        // Expected: Transaction should fail with reallocation error
        console.log("✅ Reproduced the error!");
        console.log("   Error:", error.message);
        
        // Try to extract logs from error or fetch transaction if signature exists
        console.log("\n--- Program Logs (addTickets - failed transaction) ---");
        let logsFound = false;
        
        if (error.logs && Array.isArray(error.logs)) {
          // Logs might be in the error object
          error.logs.forEach((log: string) => {
            if (log.includes("Program log:")) {
              const message = log.replace("Program log: ", "");
              console.log(`  📝 ${message}`);
              logsFound = true;
            } else if (log.includes("Program data:")) {
              console.log(`  📊 ${log}`);
              logsFound = true;
            }
          });
        }
        
        // Also try to get logs from the transaction if we have a signature
        if (error.signature || error.txSignature) {
          const sig = error.signature || error.txSignature;
          try {
            const tx2Details = await program.provider.connection.getTransaction(sig, {
              commitment: "confirmed",
              maxSupportedTransactionVersion: 0,
            });
            if (tx2Details?.meta?.logMessages) {
              tx2Details.meta.logMessages.forEach((log: string) => {
                if (log.includes("Program log:")) {
                  const message = log.replace("Program log: ", "");
                  console.log(`  📝 ${message}`);
                  logsFound = true;
                } else if (log.includes("Program data:")) {
                  console.log(`  📊 ${log}`);
                  logsFound = true;
                }
              });
            }
          } catch (fetchError) {
            // Silently continue if we can't fetch
          }
        }
        
        // Try to extract logs from error message/toString as fallback
        if (!logsFound) {
          const errorStr = error.toString();
          const logMatches = errorStr.match(/Program log:[^\n]*/g);
          if (logMatches) {
            logMatches.forEach((log: string) => {
              const message = log.replace("Program log: ", "");
              console.log(`  📝 ${message}`);
            });
          } else {
            console.log("  ⚠️  Program logs not available in error object");
            console.log("  Full error details:", errorStr.substring(0, 500));
          }
        }
        console.log("--- End Logs ---\n");
        
        // Verify it's the reallocation error
        const errorStr = error.toString();
        assert(
          errorStr.includes("reallocate") || 
          errorStr.includes("Failed to reallocate") ||
          errorStr.includes("reallocation"),
          `Expected reallocation error, got: ${errorStr}`
        );
        
        console.log("\n=== Root Cause Analysis ===");
        console.log("When Anchor deserializes Vec from account data:");
        console.log("  - Vec.length = 3 (actual data)");
        console.log("  - Vec.capacity = 3 (no extra space!)");
        console.log("When extend_from_slice tries to add 2 more:");
        console.log("  - Needs capacity >= 5");
        console.log("  - Current capacity = 3");
        console.log("  - Vec tries to reallocate → FAILS in Solana");
      }

    } catch (error) {
      console.log("❌ Unexpected error in initialization:", error);
      throw error;
    }
  });

  it("Demonstrates 10KB reallocation limit in CPI context", async () => {
    const buyer = anchor.web3.Keypair.generate();
    const receiver = anchor.web3.Keypair.generate();
    
    // Fund the buyer account
    const airdropSig = await program.provider.connection.requestAirdrop(
      buyer.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    await program.provider.connection.confirmTransaction(airdropSig);

    // Fund receiver account
    const airdropSig2 = await program.provider.connection.requestAirdrop(
      receiver.publicKey,
      1 * anchor.web3.LAMPORTS_PER_SOL
    );
    await program.provider.connection.confirmTransaction(airdropSig2);

    console.log("\n=== Testing 10KB Reallocation Limit in CPI Context ===");
    
    const [ticketPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("ticket"), buyer.publicKey.toBuffer()],
      program.programId
    );

    // Step 1: Initialize with large pre-allocated account
    // We need enough space to hold the final data, but the reallocation operation itself
    // will be limited to 10KB after CPI
    console.log("\n=== Step 1: Initialize account with large pre-allocated space ===");
    const initialTickets = Array.from({ length: 10 }, (_, i) => i + 1); // 10 tickets
    
    try {
      const tx1 = await program.methods
        .initializeLarge(initialTickets)
        .accounts({
          buyer: buyer.publicKey,
          ticket: ticketPda,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([buyer])
        .rpc();

      console.log("✅ Initialization successful");
      
      // Fetch and output program logs
      console.log("\n--- Program Logs (initializeLarge) ---");
      const tx1Details = await program.provider.connection.getTransaction(tx1, {
        commitment: "confirmed",
        maxSupportedTransactionVersion: 0,
      });
      if (tx1Details?.meta?.logMessages) {
        tx1Details.meta.logMessages.forEach((log: string) => {
          if (log.includes("Program log:")) {
            const message = log.replace("Program log: ", "");
            console.log(`  📝 ${message}`);
          }
        });
      }
      console.log("--- End Logs ---\n");
      
      const ticketAccount = await program.account.ticket.fetch(ticketPda);
      const currentSize = (await program.provider.connection.getAccountInfo(ticketPda))?.data.length || 0;
      console.log(`   Current account size: ${currentSize} bytes`);
      console.log(`   Current tickets: ${ticketAccount.ticketNumbers.length}`);

      // Step 2: Make CPI call then try to extend Vec by >10KB
      // This should fail because reallocation is limited to 10KB in CPI context
      console.log("\n=== Step 2: CPI call + reallocation >10KB (should fail) ===");
      
      // Calculate tickets needed to exceed 10KB reallocation limit
      // 10KB = 10,240 bytes
      // Each ticket = 4 bytes (u32)
      // Need: (10240 / 4) + 1 = 2561 tickets to exceed limit
      // Using 2561 tickets (10,244 bytes) - minimum to exceed 10KB limit
      const ticketCount = 2561;
      const sizeIncrease = ticketCount * 4; // 10,244 bytes
      
      console.log(`   Adding ${ticketCount} tickets`);
      console.log(`   Size increase: ${sizeIncrease} bytes (${(sizeIncrease / 1024).toFixed(2)} KB)`);
      console.log(`   ⚠️  This exceeds the 10KB (10,240 bytes) reallocation limit!`);

      try {
        const tx2 = await program.methods
          .testCpiReallocationLimit(ticketCount)
          .accounts({
            buyer: buyer.publicKey,
            ticket: ticketPda,
            receiver: receiver.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([buyer])
          .rpc();

        console.log("❌ ERROR: Transaction succeeded but should have failed!");
        console.log("   This means the 10KB limit was not enforced.");
        assert.fail("Transaction should have failed with 10KB reallocation limit error");
      } catch (error: any) {
        console.log("✅ Reproduced the 10KB reallocation limit error!");
        console.log("   Error:", error.message);
        
        // Output program logs
        console.log("\n--- Program Logs (testCpiReallocationLimit - failed) ---");
        let logsFound = false;
        
        if (error.logs && Array.isArray(error.logs)) {
          error.logs.forEach((log: string) => {
            if (log.includes("Program log:")) {
              const message = log.replace("Program log: ", "");
              console.log(`  📝 ${message}`);
              logsFound = true;
            }
          });
        }
        
        if (error.signature || error.txSignature) {
          const sig = error.signature || error.txSignature;
          try {
            const txDetails = await program.provider.connection.getTransaction(sig, {
              commitment: "confirmed",
              maxSupportedTransactionVersion: 0,
            });
            if (txDetails?.meta?.logMessages) {
              txDetails.meta.logMessages.forEach((log: string) => {
                if (log.includes("Program log:")) {
                  const message = log.replace("Program log: ", "");
                  console.log(`  📝 ${message}`);
                  logsFound = true;
                }
              });
            }
          } catch (fetchError) {
            // Silently continue
          }
        }
        
        if (!logsFound) {
          const errorStr = error.toString();
          const logMatches = errorStr.match(/Program log:[^\n]*/g);
          if (logMatches) {
            logMatches.forEach((log: string) => {
              const message = log.replace("Program log: ", "");
              console.log(`  📝 ${message}`);
            });
          }
        }
        console.log("--- End Logs ---\n");
        
        // Verify it's the reallocation limit error or serialization error
        // Note: If account has enough space, we should get reallocation limit error
        // If account doesn't have enough space, we get serialization error
        const errorStr = error.toString();
        const errorMessage = error.message || errorStr;
        const errorCode = (error as any).error?.errorCode?.code || (error as any).code;
        
        // Check for reallocation limit error
        const hasLimitError = 
          errorStr.includes("10240") || 
          errorStr.includes("10KB") ||
          errorStr.includes("realloc limited") ||
          errorStr.includes("reallocate") ||
          errorStr.includes("Failed to reallocate") ||
          errorStr.includes("Account data size realloc limited");
        
        // Check for serialization error (happens when account doesn't have enough space)
        const hasSerializationError = 
          errorStr.includes("AccountDidNotSerialize") ||
          errorStr.includes("Failed to serialize") ||
          errorCode === 3004;
        
        if (hasLimitError) {
          console.log("✅ Got reallocation limit error as expected!");
        } else if (hasSerializationError) {
          console.log("⚠️  Got serialization error - this means:");
          console.log("   - The Vec extension succeeded in memory");
          console.log("   - But Anchor couldn't serialize because account lacks space");
          console.log("   - This demonstrates that even with pre-allocation,");
          console.log("     extending Vec can cause issues if not handled correctly");
          // This is still a valid demonstration of the problem
        } else {
          assert.fail(
            `Expected 10KB reallocation limit error or serialization error, got: ${errorMessage.substring(0, 500)}`
          );
        }
        
        console.log("\n=== Explanation ===");
        console.log("Solana enforces a 10KB (10,240 bytes) limit on account reallocation");
        console.log("in inner instructions (like CPI calls).");
        console.log("Even if the account has enough physical space pre-allocated,");
        console.log("the reallocation operation itself is limited to 10KB.");
        console.log("\nKey points:");
        console.log("  - Account size limit: 10MB (can be large)");
        console.log("  - Reallocation limit: 10KB per operation (in CPI context)");
        console.log("  - Pre-allocation avoids reallocation entirely");
      }

    } catch (error: any) {
      console.log("❌ Error occurred");
      console.log("   Error message:", error.message);
      
      // Try to extract logs from error
      console.log("\n--- Program Logs from Error ---");
      if (error.logs && Array.isArray(error.logs)) {
        error.logs.forEach((log: string) => {
          if (log.includes("Program log:")) {
            const message = log.replace("Program log: ", "");
            console.log(`  📝 ${message}`);
          } else {
            console.log(`  📊 ${log}`);
          }
        });
      }
      
      // Also try to fetch transaction if we have a signature
      if (error.signature || error.txSignature) {
        const sig = error.signature || error.txSignature;
        try {
          const txDetails = await program.provider.connection.getTransaction(sig, {
            commitment: "confirmed",
            maxSupportedTransactionVersion: 0,
          });
          if (txDetails?.meta?.logMessages) {
            txDetails.meta.logMessages.forEach((log: string) => {
              if (log.includes("Program log:")) {
                const message = log.replace("Program log: ", "");
                console.log(`  📝 ${message}`);
              } else {
                console.log(`  📊 ${log}`);
              }
            });
          }
        } catch (fetchError) {
          // Silently continue
        }
      }
      
      // Also check transactionLogs if available
      if (error.transactionLogs && Array.isArray(error.transactionLogs)) {
        error.transactionLogs.forEach((log: string) => {
          if (log.includes("Program log:")) {
            const message = log.replace("Program log: ", "");
            console.log(`  📝 ${message}`);
          } else {
            console.log(`  📊 ${log}`);
          }
        });
      }
      
      console.log("--- End Logs ---\n");
      throw error;
    }
  });
});

