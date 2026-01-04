# Enum Comparison Trait Missing Error Test

## Problem
This test demonstrates a common Rust compilation error: trying to use `==` operator on an enum type that doesn't implement `PartialEq` trait.

## Understanding the Error

**Analogy**: Think of Rust traits like "permissions" or "capabilities" for types. Just like you need a driver's license to drive, types need `PartialEq` "permission" to use the `==` operator. Without it, Rust won't let you compare enum values.

**Real-world example**: Imagine comparing two keys - without knowing they're the same type of key, you can't tell if they fit the same lock. `PartialEq` tells Rust "these enum values can be compared for equality."

## Error Reproduction

The program in `programs/enum-comparison-test/src/lib.rs` contains code that will **FAIL to compile**:

```rust
// ERROR: Missing PartialEq trait
#[derive(Clone, AnchorSerialize, AnchorDeserialize)]
pub enum LotteryStatus {
    Active,
    Completed,
    Cancelled,
}

// This line causes compilation error:
require!(
    lottery.status == LotteryStatus::Active,  // ERROR: binary operation `==` cannot be applied
    LotteryError::LotteryNotActive
);
```

**To see the error:**
```bash
cd /root/errors/anchor_new/tests/enum-comparison-test
anchor build
```

You'll see:
```
error[E0369]: binary operation `==` cannot be applied to type `LotteryStatus`
  --> programs/enum-comparison-test/src/lib.rs:42:28
   |
42 |             lottery.status == LotteryStatus::Active,
   |             -------------- ^^ --------------------- LotteryStatus
```

## Solution

Add `PartialEq`, `Eq`, and `Copy` traits to the enum:

```rust
// FIXED: Added PartialEq, Eq, and Copy traits
#[derive(Clone, Copy, PartialEq, Eq, AnchorSerialize, AnchorDeserialize)]
pub enum LotteryStatus {
    Active,
    Completed,
    Cancelled,
}
```

**To apply the fix:**
```bash
# Option 1: Copy the fixed version
cp programs/enum-comparison-test/src/lib.rs.fixed programs/enum-comparison-test/src/lib.rs

# Option 2: Manually edit lib.rs and change line 8 to include PartialEq, Eq, Copy
```

**After fixing, verify it compiles:**
```bash
anchor build  # Should succeed now!
```

## Running the Test

Once the fix is applied:
```bash
anchor test
```

The test will:
1. Initialize a lottery with Active status
2. Check the status using `==` comparison (now works!)
3. Verify the transaction succeeds

## Key Takeaways

1. **PartialEq trait** enables `==` and `!=` operators for enum comparison
2. **Eq trait** (used with PartialEq) provides full equality semantics  
3. **Copy trait** allows efficient value copying (best practice for simple enums)
4. **Always derive these traits** when you need to compare enum values in Anchor programs

