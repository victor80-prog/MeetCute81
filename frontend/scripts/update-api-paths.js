const fs = require('fs');
const path = require('path');

// Function to process all JavaScript and JSX files in a directory
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
    } else if (file.name.endsWith('.js') || file.name.endsWith('.jsx')) {
      // Process JavaScript and JSX files
      await updateApiPaths(fullPath);
    }
  }
}

// Function to update API paths in a file
async function updateApiPaths(filePath) {
  try {
    let content = await fs.promises.readFile(filePath, 'utf8');
    
    // Replace '/api/' with '/' in API calls
    // This regex looks for patterns like: api.get('/api/...')
    const updatedContent = content.replace(
      /(api\.(?:get|post|put|delete|patch|head|options|request)\s*\(\s*['"])\/api\//g,
      "$1/"
    );
    
    // Only write the file if changes were made
    if (content !== updatedContent) {
      await fs.promises.writeFile(filePath, updatedContent, 'utf8');
      console.log(`Updated API paths in: ${filePath}`);
    }
  } catch (error) {
    console.error(`Error processing file ${filePath}:`, error);
  }
}

// Start processing from the src directory
const srcDir = path.join(__dirname, '..', 'src');
processFiles(srcDir)
  .then(() => console.log('Finished updating API paths'))
  .catch(console.error);
