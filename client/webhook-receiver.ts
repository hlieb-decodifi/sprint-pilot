#!/usr/bin/env node

/**
 * Webhook Receiver for Sprint Pilot
 * 
 * Local HTTP server that receives sprint data from the remote Sprint Pilot service
 * and writes it to .ai/sprint/YYYY-MM-DD-sprint.md
 * 
 * Usage:
 *   bun run webhook-receiver.ts
 *   bun run webhook-receiver.ts --port 3001
 *   bun run webhook-receiver.ts --port 3001 --secret your-webhook-secret
 */

import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { createHmac } from 'crypto';

interface WebhookPayload {
  sprintMarkdown: string;
  tickets: any[];
  metadata: {
    syncTimestamp: string;
    ticketCount: number;
    listId: string;
  };
  signature?: string;
}

function verifySignature(payload: string, signature: string, secret: string): boolean {
  const hmac = createHmac('sha256', secret);
  hmac.update(payload);
  const expectedSignature = `sha256=${hmac.digest('hex')}`;
  return signature === expectedSignature;
}

function ensureDirectoryExists(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`Created directory: ${dirPath}`);
  }
}

function writeSprintFile(markdown: string, projectRoot: string): string {
  const sprintDir = path.join(projectRoot, '.ai', 'sprint');
  ensureDirectoryExists(sprintDir);

  const date = new Date().toISOString().split('T')[0];
  const filename = `${date}-sprint.md`;
  const filepath = path.join(sprintDir, filename);

  fs.writeFileSync(filepath, markdown, 'utf-8');
  return filepath;
}

function createServer(_port: number, secret?: string): http.Server {
  const projectRoot = process.cwd();

  return http.createServer((req, res) => {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Sprint-Pilot-Signature');

    // Handle OPTIONS preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    // Only accept POST requests
    if (req.method !== 'POST') {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Method not allowed' }));
      return;
    }

    // Parse request body
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        // Verify signature if secret is configured
        if (secret) {
          const signature = req.headers['x-sprint-pilot-signature'] as string;
          if (!signature) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Missing signature header' }));
            return;
          }

          if (!verifySignature(body, signature, secret)) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid signature' }));
            return;
          }
        }

        // Parse payload
        const payload: WebhookPayload = JSON.parse(body);

        if (!payload.sprintMarkdown) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing sprintMarkdown in payload' }));
          return;
        }

        // Write sprint file
        const filepath = writeSprintFile(payload.sprintMarkdown, projectRoot);
        const relativePath = path.relative(projectRoot, filepath);

        console.log(`\n✓ Sprint file written to: ${relativePath}`);
        console.log(`  Tickets: ${payload.metadata.ticketCount}`);
        console.log(`  Synced at: ${payload.metadata.syncTimestamp}`);

        // Send success response
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          filepath: relativePath,
          ticketCount: payload.metadata.ticketCount,
        }));
      } catch (error) {
        console.error('Error processing webhook:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'Internal server error',
          message: error instanceof Error ? error.message : 'Unknown error',
        }));
      }
    });

    req.on('error', error => {
      console.error('Request error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Request processing error' }));
    });
  });
}

// Main execution
function main() {
  const args = process.argv.slice(2);
  
  let port = 3001;
  let secret: string | undefined;

  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--port' && args[i + 1]) {
      port = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--secret' && args[i + 1]) {
      secret = args[i + 1];
      i++;
    } else if (args[i] === '--help' || args[i] === '-h') {
      console.log(`
Sprint Pilot Webhook Receiver

Usage:
  bun run webhook-receiver.ts [options]

Options:
  --port <number>     Port to listen on (default: 3001)
  --secret <string>   Webhook secret for HMAC verification (optional)
  --help, -h          Show this help message

Example:
  bun run webhook-receiver.ts --port 3001 --secret my-secret-key

The receiver will write sprint files to .ai/sprint/YYYY-MM-DD-sprint.md
      `);
      process.exit(0);
    }
  }

  const server = createServer(port, secret);

  server.listen(port, () => {
    console.log(`\n🚀 Sprint Pilot Webhook Receiver`);
    console.log(`   Listening on: http://localhost:${port}`);
    console.log(`   Project root: ${process.cwd()}`);
    console.log(`   Sprint files: .ai/sprint/`);
    if (secret) {
      console.log(`   Security: HMAC signature verification enabled`);
    } else {
      console.log(`   Security: No signature verification (add --secret for HMAC)`);
    }
    console.log('\n   Waiting for webhook requests...\n');
  });

  server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`\n❌ Error: Port ${port} is already in use.`);
      console.error(`   Try a different port with --port <number>\n`);
    } else {
      console.error('\n❌ Server error:', error.message);
    }
    process.exit(1);
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n\n👋 Shutting down webhook receiver...');
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { createServer };
