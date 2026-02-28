const fs = require('fs');

const files = [
  '/Users/lucasduarte/Developer/github.com/financeApp/frontend/src/features/wallets/components/TransferModal.tsx',
  '/Users/lucasduarte/Developer/github.com/financeApp/frontend/src/features/wallets/components/AddTransactionModal.tsx',
  '/Users/lucasduarte/Developer/github.com/financeApp/frontend/src/features/wallets/components/PayInvoiceModal.tsx',
  '/Users/lucasduarte/Developer/github.com/financeApp/frontend/src/features/transactions/components/EditTransactionModal.tsx',
  '/Users/lucasduarte/Developer/github.com/financeApp/frontend/src/features/wallets/components/EditWalletModal.tsx',
  '/Users/lucasduarte/Developer/github.com/financeApp/frontend/src/features/subscriptions/components/EditSubscriptionModal.tsx',
  '/Users/lucasduarte/Developer/github.com/financeApp/frontend/src/features/subscriptions/components/CreateSubscriptionModal.tsx',
  '/Users/lucasduarte/Developer/github.com/financeApp/frontend/src/features/wallets/components/CreateWalletModal.tsx',
  '/Users/lucasduarte/Developer/github.com/financeApp/frontend/src/features/budgets/components/UpsertBudgetModal.tsx'
];

files.forEach(file => {
  if (!fs.existsSync(file)) {
    console.log('File missing: ', file);
    return;
  }
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;

  content = content.replace(/<Input([\s\S]*?)onChange=\{e => set([a-zA-Z]+)\(e\.target\.value\)\}([\s\S]*?)\/>/g, (match, before, setFnVar, after) => {
    if (match.includes('type="number"')) {
      if (match.includes('id="installments"') || match.includes('id="closingDay"') || match.includes('id="dueDay"')) {
         return match;
      }
      
      let newMatch = match.replace('<Input', '<CurrencyInput');
      newMatch = newMatch.replace(/type="number"\s*\n?\s*/g, '');
      newMatch = newMatch.replace(/step="0\.01"\s*\n?\s*/g, '');
      newMatch = newMatch.replace(/min="0\.01"\s*\n?\s*/g, '');
      newMatch = newMatch.replace(/onChange=\{e => set[a-zA-Z]+\(e\.target\.value\)\}/, `onValueChange={set${setFnVar}}`);
      return newMatch;
    }
    return match;
  });

  if (content !== originalContent) {
    if (!content.includes('import { CurrencyInput }')) {
      content = content.replace(/import \{ Input \}.*/, match => `${match}\nimport { CurrencyInput } from '@/components/CurrencyInput';`);
    }
    fs.writeFileSync(file, content, 'utf8');
    console.log('Updated', file);
  }
});
