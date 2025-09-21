# @sqd-pipes/streams

Core package of the SQD Pipes ecosystem that provides specialized streams for blockchain data consumption.

## Overview

This package offers a collection of stream implementations for different blockchain platforms:

- **Stream Abstractions**: Provides a common interface for consuming blockchain data via the Subsquid Portal
- **Chain-Specific Implementations**: Includes specialized streams for Solana and EVM blockchains
- **State Management**: Utilities for tracking stream progress and handling checkpoints

Unlike a general-purpose stream processing library, this package is specifically designed for consuming and processing blockchain-specific data types like swaps, liquidity events, and token metadata.

## Key Components

### Core Functionality
- `PortalAbstractStream`: Base abstract class for all blockchain data streams
- State management interfaces for tracking progress
- Error handling and retry mechanisms

### Solana Streams
- `SolanaSwapsStream`: For collecting DEX swap events (Orca, Raydium, Meteora)
- `SolanaLiquidityStream`: For tracking liquidity events
- `MetaplexTokenStream` and `PumpfunTokenStream`: For token metadata

### EVM Streams
- `EVMSwapsStream`: For collecting Ethereum and EVM DEX swap events

## Installation

```bash
yarn add @sqd-pipes/streams
```

## Usage

### Solana Swaps Example

```typescript
import { SolanaSwapsStream, ClickhouseState } from "@sqd-pipes/streams";

// Create a state manager for checkpointing
const clickhouseState = new ClickhouseState(client, {
  table: "sync_status",
  id: "my_indexer",
});

// Initialize the swaps stream for specific DEXes
const stream = new SolanaSwapsStream({
  portal: "https://v2.archive.subsquid.io/datasets/solana-mainnet",
  blockRange: {
    from: 12345678,
  },
  args: {
    type: ["orca_whirlpool", "raydium_amm"],
  },
  state: clickhouseState,
  logger,
});

// Process the stream data
for await (const swaps of await stream.stream()) {
  // Each swap contains details like tokens, amounts, block info
  console.log(`Processing ${swaps.length} swaps`);
  
  // After processing, update the checkpoint
  await stream.ack();
}
```

## State Management

The package provides state management interfaces:

- `ClickhouseState`: Stores checkpoint data in ClickHouse
- In-memory state tracking for development and testing

State management handles critical functionality like:
- Resuming from the last processed block
- Handling blockchain reorganizations (forks)
- Tracking indexer progress

## Error Handling

The streams include built-in error handling for common blockchain data issues:
- Network connectivity problems
- Chain reorganizations
- Rate limiting

## License

MIT
