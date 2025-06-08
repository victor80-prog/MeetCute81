const fs = require('fs');
const path = require('path');

// Function to process all test files in the src directory
async function processFiles(directory) {
  const files = await fs.promises.readdir(directory, { withFileTypes: true });
  
  for (const file of files) {
    const fullPath = path.join(directory, file.name);
    
    if (file.isDirectory()) {
      // Skip node_modules and build directories
      if (file.name === 'node_modules' || file.name === 'build' || file.name === '.next') {
        continue;
      }
      await processFiles(fullPath);
    } else if (file.name.endsWith('.test.js') || file.name.endsWith('.test.jsx')) {
      // Process test files
      await updateTestPaths(fullPath);
    }
  }
}

// Function to update API paths in test files
async function updateTestPaths(filePath) {
  try {
    let content = await fs.promises.readFile(filePath, 'utf8');
    
    // Replace '/api/' with '/' in test mocks and expectations
    const updatedContent = content
      // Replace in mock responses
      .replace(/(['"])\/api\//g, "$1/")
      // Fix any double slashes that might have been introduced
      .replace(/\/\//g, "/");
    
    // Only write the file if changes were made
    if (content !== updatedContent) {
      await fs.promises.writeFile(filePath, updatedContent, 'utf8');
      console.log(`Updated test paths in: ${filePath}`);
    }
  } catch (error) {
    console.error(`Error processing test file ${filePath}:`, error);
  }
}

// Start processing from the src directory
const srcDir = path.join(__dirname, '..', 'src');
processFiles(srcDir)
  .then(() => console.log('Finished updating test paths'))
  .catch(console.error);
