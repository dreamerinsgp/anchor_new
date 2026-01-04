use anchor_lang::prelude::*;

declare_id!("4cvtqS6DSUPmwM4JEFsdi1Leiqdexqs7zefggUycKhy2");

// ============================================================================
// ERROR VERSION: Missing PartialEq trait
// ============================================================================
// You're trying to compare enum values with ==, but Rust won't let you.
// Why? Because Rust doesn't know how to compare your enum - you haven't given
// it the "permission" (the PartialEq trait) to do so.
//
// Think of it like this: you can't use gym equipment without a membership.
// PartialEq is that membership card for the == operator.
//
// This version will FAIL to compile with error:
// "binary operation `==` cannot be applied to type `LotteryStatus`"
//
// To see the error, try: anchor build
// To fix it, see lib.rs.fixed or change line 17 to:
// #[derive(Clone, Copy, PartialEq, Eq, AnchorSerialize, AnchorDeserialize)]
#[derive(Clone, AnchorSerialize, AnchorDeserialize,PartialEq)]
pub enum LotteryStatus {
    Active,     // Tickets can be purchased
    Completed,  // Winner drawn, funds distributed
    Cancelled,  // Merchant cancelled, refunds available
}

#[account]
pub struct Lottery {
    pub merchant: Pubkey,
    pub status: LotteryStatus,
    pub ticket_price: u64,
}

#[program]
pub mod enum_comparison_test {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, ticket_price: u64) -> Result<()> {
        let lottery = &mut ctx.accounts.lottery;
        lottery.merchant = ctx.accounts.user.key();
        lottery.status = LotteryStatus::Active;
        lottery.ticket_price = ticket_price;
        Ok(())
    }

    // This function will cause a compilation error without PartialEq trait
    // ERROR: binary operation `==` cannot be applied to type `LotteryStatus`
    pub fn check_status(ctx: Context<CheckStatus>) -> Result<()> {
        let lottery = &ctx.accounts.lottery;
        
        // This line will fail to compile. You're trying to compare, but Rust
        // doesn't know how because LotteryStatus doesn't implement PartialEq.
        // It's like trying to use equipment you don't have access to.
        require!(
            lottery.status == LotteryStatus::Active,
            LotteryError::LotteryNotActive
        );
        
        msg!("Lottery is active!");
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = user,
        space = 8 + 32 + 1 + 8 // discriminator + merchant + status + ticket_price
    )]
    pub lottery: Account<'info, Lottery>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CheckStatus<'info> {
    pub lottery: Account<'info, Lottery>,
}

#[error_code]
pub enum LotteryError {
    #[msg("Lottery is not active")]
    LotteryNotActive,
}

