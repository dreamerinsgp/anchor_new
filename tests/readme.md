
I want to understand how [FEATURE_NAME] works in Anchor by adding logs to see the underlying process.

[MY_GOAL]: [Describe what you want to understand - e.g., "how Anchor validates account constraints", "how Anchor generates IDL", "how Anchor handles account deserialization", etc.]

Please:
1. Identify the relevant Anchor framework code location (e.g., lang/derive/accounts/src/lib.rs, lang/attribute/account/src/lib.rs, etc.)
2. Add logging statements to the code generation logic to show what's happening step-by-step
3. Create a simple test program in /root/anchor_test/anchor/tests/[feature-name]-test that demonstrates the feature
4. Create a test that calls the program and shows the logs
5. Update the README with instructions on how to rebuild the framework and run the test

Make sure the test uses the local anchor repository (path = "../../../../lang" in Cargo.toml).
```

## Example Usage

**Input:**
```
I want to understand how Anchor serializes account structures field-by-field by adding logs to see the underlying process.

[MY_GOAL]: I want to see logs showing when each field in a struct is being serialized, in what order, and what the generated code looks like.
```

**What it generates:**
- Modified `lang/derive/serde/src/lib.rs` with logging in `generate_struct_serialize`
- Test program at `tests/serialization-log-test/`
- README with rebuild instructions

## Quick Reference

### Common Framework Locations

- **Account serialization**: `lang/derive/serde/src/lib.rs`
- **Account deserialization**: `lang/derive/serde/src/lib.rs`
- **Account validation**: `lang/derive/accounts/src/lib.rs`
- **Account attribute macro**: `lang/attribute/account/src/lib.rs`
- **Instruction handling**: `lang/syn/src/codegen/program/handlers.rs`
- **IDL generation**: `lang/syn/src/idl/`

### Rebuilding Framework

After modifying framework code:

```bash
cd /root/anchor_test/anchor
cargo build -p [package-name]  # e.g., anchor-derive-serde, anchor-derive-accounts
```

Then rebuild your test:

```bash
cd /root/anchor_test/anchor/tests/[your-test-name]
anchor build
anchor test
```

### Test Structure Template

```
tests/[feature-name]-test/
├── programs/
│   └── [feature-name]-test/
│       ├── Cargo.toml          # Uses local anchor: path = "../../../../lang"
│       └── src/
│           └── lib.rs          # Simple program demonstrating the feature
├── tests/
│   └── [feature-name]-test.ts  # Test that calls the program and shows logs
├── Anchor.toml
├── Cargo.toml
└── README.md                    # Explains the feature, what was modified, how to rebuild
```

## Tips

1. **Start simple**: Create a minimal program that exercises the feature you want to understand
2. **Add logs at the code generation level**: Modify the derive macros or attribute macros, not just the program code
3. **Use clear log prefixes**: Like `[ANCHOR_SERIALIZE]`, `[ANCHOR_DESERIALIZE]`, etc. to identify framework logs
4. **Document the changes**: Update README with what was modified and why
5. **Test incrementally**: Build and test after each change to catch errors early

