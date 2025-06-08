const fs = require('fs');
const path = require('path');

// Function to find all JS/JSX/TS/TSX files in a directory
function findFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      findFiles(filePath, fileList);
    } else if (/\.(js|jsx|ts|tsx)$/.test(file)) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

// Find all relevant files in the frontend/src directory
const srcDir = path.join(process.cwd(), 'frontend/src');
const files = findFiles(srcDir);

// Process each file
files.forEach(file => {
  try {
    let content = fs.readFileSync(file, 'utf8');
    let updated = false;
    
    // Replace any import from '../../utils/api' with '../../services/api'
    const updatedContent = content.replace(
      /from\s+['"](?:\.\.?\/)*utils\/api['"]/g, 
      (match) => {
        // Count the number of '../' in the original import
        const upLevels = (match.match(/\.\.\//g) || []).length;
        // Create the new import path with the same number of '../'
        const newPath = '../'.repeat(upLevels) + 'services/api';
        // Use the same quote type as the original
        const quote = match.includes("'") ? "'" : '"';
        return `from ${quote}${newPath}${quote}`;
      }
    );
    
    if (content !== updatedContent) {
      fs.writeFileSync(file, updatedContent, 'utf8');
      console.log(`Updated imports in ${path.relative(process.cwd(), file)}`);
      updated = true;
    }
    
    if (!updated) {
      console.log(`No updates needed for ${path.relative(process.cwd(), file)}`);
    }
  } catch (error) {
    console.error(`Error processing ${file}:`, error.message);
  }
});

console.log('All files have been processed!');
