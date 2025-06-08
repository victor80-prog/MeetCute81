const fs = require('fs');
const path = require('path');

// Function to calculate the relative path from file to the services/api.js
function getRelativePath(filePath) {
  const dir = path.dirname(filePath);
  const relativePath = path.relative(dir, path.join(process.cwd(), 'frontend/src/services/api'));
  // Ensure the path uses forward slashes and doesn't start with ./
  let finalPath = relativePath.replace(/\\/g, '/');
  if (!finalPath.startsWith('.')) {
    finalPath = './' + finalPath;
  }
  return finalPath;
}

// Find all JS/JSX/TS/TSX files in the frontend/src directory
const files = [];
function findFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      findFiles(fullPath);
    } else if (entry.isFile() && /\.(js|jsx|ts|tsx)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
}

// Start searching from the frontend/src directory
findFiles(path.join(process.cwd(), 'frontend/src'));

// Process each file
files.forEach(file => {
  try {
    let content = fs.readFileSync(file, 'utf8');
    let updated = false;
    
    // Handle different import styles
    const importPatterns = [
      // Matches: from "../../services/api" or from '../../services/api'
      /from\s+['"](?:\.\.?\/)+(?:services\/api)['"]/g,
      // Matches: from "@/services/api" or from "@/services/api"
      /from\s+['"]@\/services\/api['"]/g
    ];
    
    for (const pattern of importPatterns) {
      if (content.match(pattern)) {
        const relativePath = getRelativePath(file);
        const quote = content.match(/from\s+['"](?:.*?)['"]/)?.[0]?.includes("'") ? "'" : '"';
        content = content.replace(
          pattern, 
          `from ${quote}${relativePath}${quote}`
        );
        updated = true;
      }
    }
    
    if (updated) {
      fs.writeFileSync(file, content, 'utf8');
      console.log(`Updated imports in ${path.relative(process.cwd(), file)}`);
    }
  } catch (error) {
    console.error(`Error processing ${file}:`, error.message);
  }
});

console.log('Import path fixes complete!');
