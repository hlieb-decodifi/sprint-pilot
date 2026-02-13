#!/usr/bin/env node

/**
 * Codebase Scanner for Sprint Pilot
 * 
 * Scans a Next.js App Router project and generates a CodebaseMap JSON.
 * This script should be run from the root of your consumer project.
 * 
 * Usage:
 *   bun run scan-codebase.ts
 *   bun run scan-codebase.ts > codebase-map.json
 *   bun run scan-codebase.ts --output codebase-map.json
 */

import * as fs from 'fs';
import * as path from 'path';

interface RouteInfo {
  path: string;
  files: string[];
  exports?: string[];
}

interface CodebaseMap {
  routes: RouteInfo[];
  components: string[];
  actions: string[];
  scannedAt: string;
}

// Next.js App Router file patterns
const ROUTE_FILES = ['page.tsx', 'page.ts', 'page.jsx', 'page.js'];
const LAYOUT_FILES = ['layout.tsx', 'layout.ts', 'layout.jsx', 'layout.js'];
const LOADING_FILES = ['loading.tsx', 'loading.ts', 'loading.jsx', 'loading.js'];
const ERROR_FILES = ['error.tsx', 'error.ts', 'error.jsx', 'error.js'];
const ACTION_FILES = ['actions.ts', 'actions.tsx', 'actions.js'];

function isDirectory(filePath: string): boolean {
  try {
    return fs.statSync(filePath).isDirectory();
  } catch {
    return false;
  }
}

function shouldIgnoreDirectory(dirName: string): boolean {
  const ignoredDirs = [
    'node_modules',
    '.next',
    '.git',
    'dist',
    'build',
    '.vercel',
    '.turbo',
  ];
  return ignoredDirs.includes(dirName) || dirName.startsWith('.');
}

function extractRoutePath(relativePath: string): string {
  // Remove 'app/' prefix
  let routePath = relativePath.replace(/^app\/?/, '');
  
  // Remove route groups: (group-name)
  routePath = routePath.replace(/\([^)]+\)/g, '');
  
  // Clean up multiple slashes
  routePath = routePath.replace(/\/+/g, '/');
  
  // Ensure starts with /
  if (!routePath.startsWith('/')) {
    routePath = '/' + routePath;
  }
  
  // Remove trailing slash unless it's root
  if (routePath !== '/' && routePath.endsWith('/')) {
    routePath = routePath.slice(0, -1);
  }
  
  return routePath;
}

function scanDirectory(
  baseDir: string,
  currentDir: string,
  depth: number,
  maxDepth: number
): {
  routes: Map<string, RouteInfo>;
  components: string[];
  actions: string[];
} {
  const routes = new Map<string, RouteInfo>();
  const components: string[] = [];
  const actions: string[] = [];

  if (depth > maxDepth) {
    return { routes, components, actions };
  }

  const entries = fs.readdirSync(currentDir);

  for (const entry of entries) {
    const fullPath = path.join(currentDir, entry);
    const relativePath = path.relative(baseDir, fullPath);

    if (isDirectory(fullPath)) {
      if (shouldIgnoreDirectory(entry)) {
        continue;
      }

      // Recursively scan subdirectory
      const subResults = scanDirectory(baseDir, fullPath, depth + 1, maxDepth);
      
      // Merge results
      subResults.routes.forEach((value, key) => routes.set(key, value));
      components.push(...subResults.components);
      actions.push(...subResults.actions);
    } else {
      const ext = path.extname(entry);
      const basename = path.basename(entry, ext);

      // Check if it's a route file
      if (ROUTE_FILES.includes(entry) || 
          LAYOUT_FILES.includes(entry) ||
          LOADING_FILES.includes(entry) ||
          ERROR_FILES.includes(entry)) {
        
        const routePath = extractRoutePath(path.dirname(relativePath));
        const existing = routes.get(routePath);
        
        if (existing) {
          existing.files.push(entry);
        } else {
          routes.set(routePath, {
            path: routePath,
            files: [entry],
          });
        }
      }
      
      // Check if it's a server actions file
      if (ACTION_FILES.includes(entry)) {
        actions.push(relativePath.replace(/\\/g, '/'));
      }
      
      // Check if it's a component
      if (['.tsx', '.jsx'].includes(ext)) {
        // Identify as component if in components/ dir or ends with .client.tsx
        if (relativePath.includes('components/') || 
            basename.endsWith('.client') ||
            relativePath.includes('/ui/')) {
          components.push(relativePath.replace(/\\/g, '/'));
        }
      }
    }
  }

  return { routes, components, actions };
}

function scanCodebase(projectRoot: string, maxDepth = 10): CodebaseMap {
  const appDir = path.join(projectRoot, 'app');

  if (!fs.existsSync(appDir)) {
    console.error('Error: app/ directory not found. Are you in a Next.js App Router project?');
    process.exit(1);
  }

  console.error('Scanning codebase...');
  const results = scanDirectory(projectRoot, appDir, 0, maxDepth);

  // Convert routes map to array
  const routesArray: RouteInfo[] = Array.from(results.routes.values()).sort(
    (a, b) => a.path.localeCompare(b.path)
  );

  console.error(`Found ${routesArray.length} routes`);
  console.error(`Found ${results.components.length} components`);
  console.error(`Found ${results.actions.length} server actions`);

  return {
    routes: routesArray,
    components: results.components.sort(),
    actions: results.actions.sort(),
    scannedAt: new Date().toISOString(),
  };
}

// Main execution
function main() {
  const args = process.argv.slice(2);
  const outputFile = args.includes('--output') 
    ? args[args.indexOf('--output') + 1] 
    : null;

  const projectRoot = process.cwd();
  const codebaseMap = scanCodebase(projectRoot);

  const json = JSON.stringify(codebaseMap, null, 2);

  if (outputFile) {
    fs.writeFileSync(outputFile, json);
    console.error(`Codebase map written to ${outputFile}`);
  } else {
    // Output to stdout for piping
    console.log(json);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { scanCodebase };
