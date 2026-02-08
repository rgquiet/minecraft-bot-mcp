# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MCP Minecraft Remote is a Model Context Protocol (MCP) server that enables AI assistants to control a Minecraft player. It uses mineflayer to connect to Minecraft Java Edition servers (tested on 1.21, requires `online-mode=false` for non-premium accounts).

## Build Commands

```bash
npm install        # Install dependencies
npm run build      # Compile TypeScript to build/
npm run start      # Run the compiled server
```

The build outputs to `build/` and the entry point is `build/index.js`.

## Architecture

### Entry Point & Server Setup

- `src/index.ts` - Entry point: registers tools, creates stdio transport, starts MCP server
- `src/server.ts` - Creates the McpServer instance and manages global bot state (`botState`)
- `src/types.ts` - Shared TypeScript interfaces (BotState, ConnectionInfo, ToolResponse)

### Tool Registration Pattern

Tools are organized by category in `src/tools/`. Each file exports a `register*Tools()` function that registers tools with the MCP server using `server.tool()`.

Tool registration signature:
```typescript
server.tool(
  'toolName',           // Tool identifier
  'Description',        // Human-readable description
  { /* zod schema */ }, // Input parameters using zod
  async (params) => {   // Handler returning ToolResponse
    return createSuccessResponse('message')
  }
)
```

### Tool Categories

- `connect.ts` - Server connection/disconnection (uses mineflayer-pathfinder plugin)
- `movement.ts`, `basicMovement.ts` - Player movement and navigation
- `blocks.ts` - Mining and block placement
- `chat.ts` - In-game messaging
- `info.ts` - Server/player information
- `inventory.ts`, `inventoryManagement.ts` - Inventory operations
- `entityInteraction.ts` - Attacking, following entities
- `containerInteraction.ts` - Chest/furnace interaction
- `crafting.ts` - Item crafting
- `trading.ts` - Villager trading

### Response Utilities

Use `src/utils/error-handler.ts` for consistent responses:
- `createSuccessResponse(message)` - Success message
- `createErrorResponse(error)` - Error handling
- `createNotConnectedResponse()` - When bot not connected
- `createAlreadyConnectedResponse()` - When already connected

### Global State

The `botState` object in `server.ts` tracks:
- `bot` - mineflayer.Bot instance (null when disconnected)
- `isConnected` - Connection status boolean
- `connectionInfo` - Host, port, username, version
- `currentContainer` - Open chest/furnace window

## Key Dependencies

- `@modelcontextprotocol/sdk` - MCP server implementation
- `mineflayer` - Minecraft bot framework
- `mineflayer-pathfinder` - Pathfinding for movement
- `zod` - Schema validation for tool parameters
