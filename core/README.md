# @sqd-pipes/core

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

## Installation

```bash
yarn add @sqd-pipes/core
```

## License

MIT
