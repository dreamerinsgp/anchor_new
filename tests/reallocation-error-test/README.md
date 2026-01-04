# Vec Reallocation Error Test

This test reproduces the "Failed to reallocate account data" error that occurs when trying to extend a `Vec<u32>` in a Solana Anchor program.

## Problem

When Anchor deserializes a `Vec` from account data:
- **Length** is restored correctly
- **Capacity** is set equal to length (no extra space!)

When you try to extend the Vec using `extend_from_slice()`:
- Vec needs more capacity
- It tries to reallocate memory
- **Reallocation fails in Solana** → Error!

## Test Flow

1. **First purchase**: Initialize account with 3 tickets ✅ (works)
2. **Second purchase**: Try to add 2 more tickets ❌ (fails with reallocation error)

## Running the Test

```bash
cd /root/errors/anchor_new/tests/reallocation-error-test
anchor test
```

The test expects the second transaction to fail with a reallocation error, demonstrating the bug.

