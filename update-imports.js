const fs = require('fs');
const path = require('path');

// Files that import from '../utils/api'
const files = [
  '/home/wiseman/Downloads/MeetCute81/frontend/src/components/UserBalanceDisplay.test.js',
  '/home/wiseman/Downloads/MeetCute81/frontend/src/components/UserBalanceDisplay.jsx',
  '/home/wiseman/Downloads/MeetCute81/frontend/src/services/chatService.js',
  '/home/wiseman/Downloads/MeetCute81/frontend/src/pages/DepositPage.jsx',
  '/home/wiseman/Downloads/MeetCute81/frontend/src/pages/WithdrawalPage.jsx',
  '/home/wiseman/Downloads/MeetCute81/frontend/src/pages/VerifyEmailPage.test.js',
  '/home/wiseman/Downloads/MeetCute81/frontend/src/pages/ConfirmSubscriptionPage.jsx',
  '/home/wiseman/Downloads/MeetCute81/frontend/src/pages/Gifts.test.js',
  '/home/wiseman/Downloads/MeetCute81/frontend/src/pages/Pricing.jsx',
  '/home/wiseman/Downloads/MeetCute81/frontend/src/pages/Messages.jsx',
  '/home/wiseman/Downloads/MeetCute81/frontend/src/pages/WithdrawalPage.test.js',
  '/home/wiseman/Downloads/MeetCute81/frontend/src/pages/Register.jsx',
  '/home/wiseman/Downloads/MeetCute81/frontend/src/pages/ConfirmSubscriptionPage.test.js',
  '/home/wiseman/Downloads/MeetCute81/frontend/src/pages/Discover.jsx',
  '/home/wiseman/Downloads/MeetCute81/frontend/src/pages/Matches.jsx',
  '/home/wiseman/Downloads/MeetCute81/frontend/src/pages/AdminDashboard.jsx',
  '/home/wiseman/Downloads/MeetCute81/frontend/src/pages/Dashboard.jsx',
  '/home/wiseman/Downloads/MeetCute81/frontend/src/pages/Register.test.js',
  '/home/wiseman/Downloads/MeetCute81/frontend/src/contexts/SubscriptionContext.jsx',
  '/home/wiseman/Downloads/MeetCute81/frontend/src/contexts/AuthContext.jsx'
];

files.forEach(file => {
  try {
    let content = fs.readFileSync(file, 'utf8');
    const updatedContent = content.replace(
      /from ['"]\.\.\/utils\/api['"]/g, 
      match => match.includes("'") ? "from '../../services/api'" : 'from "../../services/api"'
    );
    
    if (content !== updatedContent) {
      fs.writeFileSync(file, updatedContent, 'utf8');
      console.log(`Updated imports in ${file}`);
    }
  } catch (error) {
    console.error(`Error processing ${file}:`, error.message);
  }
});

console.log('Import updates complete!');
