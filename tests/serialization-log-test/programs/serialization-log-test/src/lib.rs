use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

// Enum with required traits (as per the lesson)
#[derive(Clone, AnchorSerialize, AnchorDeserialize)]
pub enum LotteryStatus {
    Active,     // Tickets can be purchased
    Completed,  // Winner drawn, funds distributed
    Cancelled,  // Merchant cancelled, refunds available
}

// Account structure with multiple fields
#[account]
pub struct TestAccount {
    pub status: LotteryStatus,
    pub number: u64,
    pub name: String,
    pub active: bool,
    pub amount: u128,
}

#[program]
pub mod serialization_log_test {
    use super::*;

    /// Initialize account - Anchor will serialize automatically when this function returns Ok(())
    pub fn initialize(ctx: Context<Initialize>, number: u64, name: String, amount: u128) -> Result<()> {
        let account = &mut ctx.accounts.test_account;
        
        msg!("=== Initializing account ===");
        msg!("Setting status: Active");
        account.status = LotteryStatus::Active;
        
        msg!("Setting number: {}", number);
        account.number = number;
        
        msg!("Setting name: {}", name);
        account.name = name;
        
        msg!("Setting active: true");
        account.active = true;
        
        msg!("Setting amount: {}", amount);
        account.amount = amount;
        
        msg!("=== Account fields set ===");
        msg!("Field order: status -> number -> name -> active -> amount");
        msg!("Anchor will automatically serialize when this function returns Ok(())");
        
        // That's it! No manual serialization needed.
        // Anchor automatically calls account.try_serialize() when the function exits successfully.
        
        Ok(())
    }

    /// Update account - Anchor will serialize automatically when this function returns Ok(())
    pub fn update(ctx: Context<Update>, status: u8, number: u64, name: String, active: bool, amount: u128) -> Result<()> {
        let account = &mut ctx.accounts.test_account;
        
        msg!("=== Updating account ===");
        
        // Update status
        account.status = match status {
            0 => LotteryStatus::Active,
            1 => LotteryStatus::Completed,
            2 => LotteryStatus::Cancelled,
            _ => return Err(ErrorCode::InvalidStatus.into()),
        };
        msg!("Updated status field");
        
        account.number = number;
        msg!("Updated number field: {}", number);
        
        account.name = name.clone();
        msg!("Updated name field: {}", name);
        
        account.active = active;
        msg!("Updated active field: {}", active);
        
        account.amount = amount;
        msg!("Updated amount field: {}", amount);
        
        msg!("=== All fields updated ===");
        msg!("Anchor will automatically serialize when this function returns Ok(())");
        
        // That's it! No manual serialization needed.
        // Anchor automatically calls account.try_serialize() when the function exits successfully.
        
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = user,
        space = 8 + 1 + 8 + 4 + 100 + 1 + 16 // discriminator + status + number + name(len+data) + active + amount
    )]
    pub test_account: Account<'info, TestAccount>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Update<'info> {
    #[account(mut)]
    pub test_account: Account<'info, TestAccount>,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Invalid status value")]
    InvalidStatus,
}

