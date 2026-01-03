use anchor_lang::prelude::*;
use anchor_lang::AnchorSerialize;
use std::io::Write;

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

    /// Initialize account - this will trigger serialization
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
        
        msg!("=== Account fields set, serialization will happen automatically ===");
        msg!("Field order: status -> number -> name -> active -> amount");
        
        // Manually serialize to see the process
        msg!("=== Manual serialization with logging ===");
        let mut buffer = Vec::new();
        account.try_serialize(&mut buffer)?;
        
        msg!("Total serialized size: {} bytes", buffer.len());
        msg!("Discriminator (first 8 bytes): {:?}", &buffer[0..8]);
        msg!("Remaining data: {} bytes", buffer.len() - 8);
        
        Ok(())
    }

    /// Update account - this will also trigger serialization
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
        
        msg!("=== All fields updated, serialization will happen automatically ===");
        
        // Manual serialization with detailed logging
        msg!("=== Manual serialization with field-by-field logging ===");
        let mut buffer = Vec::new();
        
        // Write discriminator
        let disc = TestAccount::DISCRIMINATOR;
        msg!("Writing discriminator (8 bytes): {:?}", disc);
        buffer.write_all(disc)?;
        
        // Serialize each field manually to see the process
        // Using borsh::to_vec() helper function
        msg!("Serializing status field (enum)...");
        let mut status_writer = Vec::new();
        AnchorSerialize::serialize(&account.status, &mut status_writer)?;
        msg!("Status serialized to {} bytes: {:?}", status_writer.len(), status_writer);
        buffer.write_all(&status_writer)?;
        
        msg!("Serializing number field (u64)...");
        let mut number_writer = Vec::new();
        AnchorSerialize::serialize(&account.number, &mut number_writer)?;
        msg!("Number serialized to {} bytes: {:?}", number_writer.len(), number_writer);
        buffer.write_all(&number_writer)?;
        
        msg!("Serializing name field (String)...");
        let mut name_writer = Vec::new();
        AnchorSerialize::serialize(&account.name, &mut name_writer)?;
        msg!("Name serialized to {} bytes: {:?}", name_writer.len(), name_writer);
        buffer.write_all(&name_writer)?;
        
        msg!("Serializing active field (bool)...");
        let mut active_writer = Vec::new();
        AnchorSerialize::serialize(&account.active, &mut active_writer)?;
        msg!("Active serialized to {} bytes: {:?}", active_writer.len(), active_writer);
        buffer.write_all(&active_writer)?;
        
        msg!("Serializing amount field (u128)...");
        let mut amount_writer = Vec::new();
        AnchorSerialize::serialize(&account.amount, &mut amount_writer)?;
        msg!("Amount serialized to {} bytes: {:?}", amount_writer.len(), amount_writer);
        buffer.write_all(&amount_writer)?;
        
        msg!("=== Total serialized size: {} bytes ===", buffer.len());
        
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

