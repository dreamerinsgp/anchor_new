use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod reallocation_error_test {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, initial_tickets: Vec<u32>) -> Result<()> {
        let ticket = &mut ctx.accounts.ticket;
        ticket.buyer = ctx.accounts.buyer.key();
        ticket.ticket_numbers = initial_tickets;
        msg!("Initialized ticket account with {} tickets", ticket.ticket_numbers.len());
        Ok(())
    }

    // Initialize with larger space for CPI reallocation limit test
    pub fn initialize_large(ctx: Context<InitializeLarge>, initial_tickets: Vec<u32>) -> Result<()> {
        let ticket = &mut ctx.accounts.ticket;
        ticket.buyer = ctx.accounts.buyer.key();
        ticket.ticket_numbers = initial_tickets;
        msg!("Initialized large ticket account with {} tickets", ticket.ticket_numbers.len());
        Ok(())
    }

    // BUG: This function tries to extend Vec directly, which triggers reallocation
    // Anchor deserializes Vec with capacity = length, so extend_from_slice fails
    pub fn add_tickets(ctx: Context<AddTickets>, new_tickets: Vec<u32>) -> Result<()> {
        let ticket = &mut ctx.accounts.ticket;
        
        msg!("=== add_tickets execution started ===");
        msg!("Current tickets count: {}", ticket.ticket_numbers.len());
        msg!("New tickets to add: {}", new_tickets.len());
        msg!("Vec capacity before extend: {}", ticket.ticket_numbers.capacity());
        msg!("Vec length before extend: {}", ticket.ticket_numbers.len());
        
        // ❌ BUG: Direct extension triggers reallocation
        // When Anchor deserializes Vec, capacity = length (no extra space)
        // extend_from_slice will try to reallocate, which fails in Solana
        msg!("Calling extend_from_slice (this will trigger reallocation)...");
        ticket.ticket_numbers.extend_from_slice(&new_tickets);
        
        msg!("extend_from_slice completed successfully");
        msg!("Vec capacity after extend: {}", ticket.ticket_numbers.capacity());
        msg!("Vec length after extend: {}", ticket.ticket_numbers.len());
        msg!("Added {} tickets, total now: {}", 
             new_tickets.len(), 
             ticket.ticket_numbers.len());
        msg!("=== add_tickets execution completed ===");
        Ok(())
    }

    // Test: Demonstrate 10KB reallocation limit in CPI context
    // This function makes a CPI call, then tries to extend Vec which triggers reallocation
    // Even if account has enough physical space, reallocation fails after CPI if >10KB
    pub fn test_cpi_reallocation_limit(
        ctx: Context<TestCpiReallocation>, 
        ticket_count: u32  // Number of tickets to add (not the full array to avoid serialization limits)
    ) -> Result<()> {
        // Get size before creating mutable borrow
        let current_size = ctx.accounts.ticket.to_account_info().data_len();
        let current_tickets = ctx.accounts.ticket.ticket_numbers.len();
        let ticket = &mut ctx.accounts.ticket;
        
        msg!("=== Testing CPI Reallocation Limit ===");
        msg!("Current account size: {} bytes", current_size);
        msg!("Current tickets: {}", current_tickets);
        
        // Generate tickets internally to avoid instruction data size limits
        let new_tickets: Vec<u32> = (0..ticket_count)
            .map(|i| i + 1000) // Start from 1000 to avoid conflicts
            .collect();
        
        let size_increase = (new_tickets.len() * 4) as u64; // 4 bytes per u32
        msg!("New tickets to add: {} ({} bytes, {:.2} KB)", 
             new_tickets.len(), 
             size_increase,
             size_increase as f64 / 1024.0);
        

              // Step 2: Try to extend Vec - this will trigger reallocation
        // If the increase is > 10KB, this will fail even though account has physical space
        msg!("Step 2: Attempting to extend Vec (will trigger reallocation)...");
        msg!("Vec capacity before: {}", ticket.ticket_numbers.capacity());
        msg!("Vec length before: {}", ticket.ticket_numbers.len());
        
        if size_increase > 10240 {
            msg!("⚠️  Size increase ({}) exceeds 10KB (10,240 bytes) limit!", size_increase);
        }
        
        // This will trigger Anchor's reallocation logic
        // In CPI context, if increase > 10KB, this will fail
        ticket.ticket_numbers.extend_from_slice(&new_tickets);
        
        msg!("✅ Vec extension succeeded");
        msg!("Vec capacity after: {}", ticket.ticket_numbers.capacity());
        msg!("Vec length after: {}", ticket.ticket_numbers.len());


        // Step 1: Make a CPI call (transfer some lamports)
        // After a CPI call, Solana considers the program to be in "inner instruction context"
        // In this context, account reallocation is limited to 10KB (10,240 bytes) per operation
        // See: luckyDraw/lessons/errors/3.1.innerInstruction_context.md for details
        msg!("Step 1: Making CPI call (transfer)...");
        anchor_lang::solana_program::program::invoke(
            &anchor_lang::solana_program::system_instruction::transfer(
                ctx.accounts.buyer.key,
                ctx.accounts.receiver.key,
                1000, // Transfer 1000 lamports
            ),
            &[
                ctx.accounts.buyer.to_account_info(),
                ctx.accounts.receiver.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;
        msg!("CPI call completed successfully");
        msg!("⚠️  Now in CPI context - reallocation limited to 10KB!");
        
       
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,
    
    #[account(
        init,
        payer = buyer,
        space = Ticket::space(100), // Pre-allocate space for 100 tickets
        seeds = [b"ticket", buyer.key().as_ref()],
        bump
    )]
    pub ticket: Account<'info, Ticket>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AddTickets<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"ticket", buyer.key().as_ref()],
        bump
    )]
    pub ticket: Account<'info, Ticket>,
}

#[derive(Accounts)]
pub struct InitializeLarge<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,
    
    #[account(
        init,
        payer = buyer,
        space = Ticket::space(1000), // Pre-allocate space for 3000 tickets (~12KB)
        seeds = [b"ticket", buyer.key().as_ref()],
        bump
    )]
    pub ticket: Account<'info, Ticket>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct TestCpiReallocation<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"ticket", buyer.key().as_ref()],
        bump
    )]
    pub ticket: Account<'info, Ticket>,
    
    /// CHECK: Receiver for CPI transfer (can be any account)
    #[account(mut)]
    pub receiver: AccountInfo<'info>,
    
    pub system_program: Program<'info, System>,
}

#[account]
pub struct Ticket {
    pub buyer: Pubkey,
    pub ticket_numbers: Vec<u32>,
}

impl Ticket {
    pub fn space(ticket_count: u32) -> usize {
        8 +      // discriminator
        32 +     // buyer
        4 +      // Vec length prefix
        (ticket_count as usize * 4) // 4 bytes per u32
    }
}

