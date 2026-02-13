import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as fs from 'fs';
import * as path from 'path';

// Simple in-memory job storage (in production, use Vercel KV or database)
interface JobRecord {
  id: string;
  timestamp: string;
  listId: string;
  ticketCount: number;
  status: 'success' | 'failed';
  error?: string;
}

const jobs: JobRecord[] = [];

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  const { pathname } = new URL(req.url || '', `http://${req.headers.host}`);

  // Serve dashboard HTML
  if (pathname === '/' || pathname === '') {
    try {
      const htmlPath = path.join(process.cwd(), 'public', 'index.html');
      const html = fs.readFileSync(htmlPath, 'utf-8');
      res.setHeader('Content-Type', 'text/html');
      res.status(200).send(html);
    } catch (error) {
      res.status(500).json({ error: 'Failed to load dashboard' });
    }
    return;
  }

  // API: Get recent jobs
  if (pathname === '/api/jobs' && req.method === 'GET') {
    res.status(200).json({
      jobs: jobs.slice(-50).reverse(), // Last 50 jobs, newest first
    });
    return;
  }

  // API: Get specific job
  if (pathname?.startsWith('/api/jobs/') && req.method === 'GET') {
    const jobId = pathname.split('/').pop();
    const job = jobs.find(j => j.id === jobId);
    
    if (job) {
      res.status(200).json(job);
    } else {
      res.status(404).json({ error: 'Job not found' });
    }
    return;
  }

  // API: Test webhook
  if (pathname === '/api/test-webhook' && req.method === 'POST') {
    try {
      const { webhookUrl } = req.body;
      
      if (!webhookUrl) {
        res.status(400).json({ error: 'Missing webhookUrl in body' });
        return;
      }

      const testPayload = {
        sprintMarkdown: '# Test Sprint\n\nThis is a test webhook delivery from Sprint Pilot.',
        tickets: [],
        metadata: {
          syncTimestamp: new Date().toISOString(),
          ticketCount: 0,
          listId: 'test',
        },
      };

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testPayload),
      });

      if (response.ok) {
        res.status(200).json({ success: true, message: 'Webhook test successful' });
      } else {
        res.status(200).json({
          success: false,
          message: `Webhook returned ${response.status}: ${response.statusText}`,
        });
      }
    } catch (error) {
      res.status(200).json({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
    return;
  }

  // 404 for other routes
  res.status(404).json({ error: 'Not found' });
}
