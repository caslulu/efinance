const fs = require('fs');
const path = require('path');

const walkSync = (dir, filelist = []) => {
  fs.readdirSync(dir).forEach(file => {
    const dirFile = path.join(dir, file);
    try {
      filelist = walkSync(dirFile, filelist);
    } catch (err) {
      if (err.code === 'ENOTDIR' || err.code === 'EBADF') filelist.push(dirFile);
    }
  });
  return filelist;
};

const files = walkSync('./frontend/src').filter(f => f.endsWith('.tsx') || f.endsWith('.ts'));

let replacements = {
  // Backgrounds
  "bg-white": "bg-card",
  "bg-gray-50": "bg-muted",
  "bg-gray-100": "bg-muted",
  "bg-gray-200": "bg-muted",
  "bg-gray-300": "bg-muted",
  "bg-gray-50/50": "bg-muted/50",
  "bg-gray-100/50": "bg-muted/50",
  "hover:bg-gray-50": "hover:bg-accent hover:text-accent-foreground",
  "hover:bg-gray-100": "hover:bg-accent hover:text-accent-foreground",
  "hover:bg-gray-200": "hover:bg-accent hover:text-accent-foreground",
  "bg-blue-50/50": "bg-blue-900/20",
  "bg-blue-50/30": "bg-blue-900/10",
  "hover:bg-blue-50": "hover:bg-blue-900/30",
  
  // Text
  "text-gray-900": "text-foreground",
  "text-gray-800": "text-foreground",
  "text-gray-700": "text-foreground",
  "text-gray-600": "text-muted-foreground",
  "text-gray-500": "text-muted-foreground",
  "text-gray-400": "text-muted-foreground",
  "hover:text-gray-900": "hover:text-foreground",
  "hover:text-gray-800": "hover:text-foreground",
  "hover:text-gray-700": "hover:text-foreground",
  "hover:text-gray-600": "hover:text-foreground",
  
  // Borders
  "border-gray-100": "border-border",
  "border-gray-200": "border-border",
  "border-gray-300": "border-border",
  "border-gray-400": "border-border",
  "border-gray-500": "border-border",
};

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let newContent = content;
  
  // Specific fix for min-h-screen wrappers
  newContent = newContent.replace(/min-h-screen\s+bg-(?:gray-50|white)/g, 'min-h-screen bg-background');
  // Or just flex min-h-screen ... bg-gray-50
  newContent = newContent.replace(/bg-(?:gray-50|white)\s+px-4/g, 'bg-background px-4');
  
  for (let [key, val] of Object.entries(replacements)) {
    // Regex logic to ensure we match full tailwind classes and not subsets
    let regex = new RegExp(`(?<![a-zA-Z0-9-/:])${key}(?![a-zA-Z0-9-/])`, 'g');
    newContent = newContent.replace(regex, val);
  }
  
  // Strip hardcoded dark equivalents now that we use dynamic shadcn colors
  newContent = newContent.replace(/(?<![a-zA-Z0-9-/:])dark:bg-gray-\\d+(?![a-zA-Z0-9-/])/g, '');
  newContent = newContent.replace(/(?<![a-zA-Z0-9-/:])dark:text-gray-\\d+(?![a-zA-Z0-9-/])/g, '');
  newContent = newContent.replace(/(?<![a-zA-Z0-9-/:])dark:border-gray-\\d+(?![a-zA-Z0-9-/])/g, '');
  newContent = newContent.replace(/(?<![a-zA-Z0-9-/:])dark:hover:bg-gray-\\d+(?![a-zA-Z0-9-/])/g, '');
  newContent = newContent.replace(/(?<![a-zA-Z0-9-/:])dark:hover:text-gray-\\d+(?![a-zA-Z0-9-/])/g, '');
  
  if (content !== newContent) {
    fs.writeFileSync(file, newContent);
  }
});
