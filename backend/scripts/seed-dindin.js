/**
 * One-off seed for the real financial data in ../../dindin.
 *
 * Usage inside the backend image (with DATABASE_URL pointing at the target DB):
 *   node scripts/seed-dindin.js
 *   DRY_RUN=1 node scripts/seed-dindin.js
 *
 * The script is intentionally conservative:
 * - it refuses to run on a database that already has transactions/cards/subs/budgets;
 * - everything happens in one transaction;
 * - DRY_RUN=1 executes all inserts and validations, then rolls back;
 * - balances are stored as explicit snapshots after the historical import;
 * - future recurring income is represented by finite future transactions, not
 *   Subscription rows (the Subscription model has no end date and the scheduler
 *   backfills every overdue cycle).
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const AS_OF = new Date('2026-10-28T23:59:59.999Z');
const DRY_RUN = process.env.DRY_RUN === '1';
const CSV_DIR = process.env.CSV_DIR || path.join(__dirname, '..', '..', 'dindin');
const ALLOW_NONEMPTY = process.env.ALLOW_NONEMPTY === '1';

const ACCOUNT_CSV = 'nubank_conta_2025-10_a_2026-10_ATUALIZADO.csv';
const CARD_CSV = 'nubank_cartao_2025-10_a_2026-11_ATUALIZADO.csv';

const CATEGORY_DEFS = [
  ['Salário', 'DollarSign'],
  ['Freelance', 'Briefcase'],
  ['Benefícios (VA/Flash)', 'Utensils'],
  ['Reembolsos e estornos', 'RotateCcw'],
  ['Supermercado', 'ShoppingBag'],
  ['Delivery', 'Utensils'],
  ['Restaurantes e bares', 'Beer'],
  ['Padaria e lanches', 'Coffee'],
  ['Casa e utilidades', 'Home'],
  ['Casa - Guarda-roupa', 'Home'],
  ['Casa - Compra reembolsada', 'Home'],
  ['Água', 'Droplets'],
  ['Telefone/Internet', 'Smartphone'],
  ['Transporte - Casa/Trabalho', 'Car'],
  ['Transporte - Trabalho/Casa', 'Car'],
  ['Transporte - Trabalho/Namorada', 'Car'],
  ['Transporte - Extras', 'Car'],
  ['Transporte - Van', 'Bus'],
  ['Transporte - Ônibus', 'Bus'],
  ['Transporte - Assinatura', 'Car'],
  ['Veículo - Consórcio', 'Car'],
  ['Academia', 'Dumbbell'],
  ['Saúde e farmácia', 'Stethoscope'],
  ['Barbearia e estética', 'Scissors'],
  ['Vestuário', 'Shirt'],
  ['Tecnologia - MacBook', 'Laptop'],
  ['Tecnologia - iPhone', 'Smartphone'],
  ['Tecnologia e eletrônicos', 'Laptop'],
  ['Compras online', 'ShoppingBag'],
  ['Presentes', 'Gift'],
  ['Eventos e lazer', 'Music'],
  ['Viagem - Chile', 'Plane'],
  ['Viagem', 'Plane'],
  ['Assinaturas e serviços', 'CreditCard'],
  ['IA e produtividade', 'Laptop'],
  ['Cursos e educação', 'GraduationCap'],
  ['Finanças e tarifas', 'CreditCard'],
  ['Impostos e IOF', 'DollarSign'],
  ['Investimentos', 'PiggyBank'],
  ['Pagamento de fatura', 'CreditCard'],
  ['Transferência entre contas próprias', 'DollarSign'],
  ['Família e amigos', 'Heart'],
  ['Terceiros - Pai', 'Heart'],
  ['Revenda', 'Briefcase'],
  ['Freelance - Insumos', 'Briefcase'],
  ['Outro', 'HelpCircle'],
];

const FIXED_EXPENSE_CATEGORIES = new Set([
  'Água',
  'Telefone/Internet',
  'Transporte - Van',
  'Veículo - Consórcio',
  'Academia',
  'IA e produtividade',
  'Finanças e tarifas',
  'Barbearia e estética',
  'Assinaturas e serviços',
  'Transporte - Assinatura',
]);

// ---------------------------------------------------------------------------
// Small utilities
// ---------------------------------------------------------------------------

function sha1(value) {
  return crypto.createHash('sha1').update(String(value)).digest('hex');
}

function slug(value) {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parseNumber(raw) {
  if (raw === null || raw === undefined) return null;
  let value = String(raw).trim();
  if (!value) return null;
  value = value.replace(/R\$/gi, '').replace(/\s/g, '');
  let negative = false;
  if (value.startsWith('-')) {
    negative = true;
    value = value.slice(1);
  }
  if (value.includes(',') && value.includes('.')) {
    value = value.replace(/\./g, '').replace(',', '.');
  } else if (value.includes(',')) {
    value = value.replace(',', '.');
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return negative ? -parsed : parsed;
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

function parseDateBr(raw) {
  const [day, month, year] = String(raw).trim().split('/').map(Number);
  if (!day || !month || !year) return null;
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function parseDateAny(raw) {
  const value = String(raw).trim();
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  return parseDateBr(value);
}

function dateAtNoon(iso) {
  return new Date(`${iso}T12:00:00.000Z`);
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function money(value) {
  return Number(value).toFixed(2);
}

function csvEscape(value) {
  const text = value === null || value === undefined ? '' : String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];
    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (char !== '\r') {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function readCsvObjects(filePath) {
  const content = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  const rows = parseCsv(content).filter((row) =>
    row.some((cell) => String(cell).trim() !== ''),
  );
  if (rows.length === 0) return [];
  const headers = rows[0].map((header) => header.trim());
  return rows.slice(1).map((row) => {
    const object = {};
    headers.forEach((header, index) => {
      object[header] = row[index] !== undefined ? String(row[index]).trim() : '';
    });
    return object;
  });
}

function shortAccountDescription(description) {
  const raw = String(description || '').trim();
  if (raw.startsWith('Transferência recebida pelo Pix - ')) {
    return `Pix recebido - ${raw.split(' - ')[1]?.split(' - ')[0] || ''}`;
  }
  if (raw.startsWith('Transferência enviada pelo Pix - ')) {
    return `Pix enviado - ${raw.split(' - ')[1]?.split(' - ')[0] || ''}`;
  }
  if (raw.startsWith('Transferência Recebida - ')) {
    return `Pix recebido - ${raw.split(' - ')[1]?.split(' - ')[0] || ''}`;
  }
  if (raw.startsWith('Reembolso recebido pelo Pix - ')) {
    return `Reembolso - ${raw.split(' - ')[1]?.split(' - ')[0] || ''}`;
  }
  if (raw.startsWith('Pagamento de boleto efetuado - ')) {
    return `Boleto - ${raw.split(' - ')[1] || ''}`;
  }
  if (raw.startsWith('Compra no débito via NuPay - ')) {
    return `Débito - ${raw.split(' - ')[1] || ''}`;
  }
  if (raw.startsWith('Compra no débito - ')) {
    return `Débito - ${raw.split(' - ')[1] || ''}`;
  }
  if (raw.startsWith('Compra de Ações - ')) {
    return `Compra de ações - ${raw.split(' - ')[1] || ''}`;
  }
  if (raw === 'Pagamento de fatura') {
    return 'Pagamento de fatura - Nubank Ultravioleta';
  }
  return raw.replace(/\s+/g, ' ').slice(0, 250);
}

// ---------------------------------------------------------------------------
// Categorisation rules
// ---------------------------------------------------------------------------

function mapAccount(row) {
  const description = row['Descrição'] || '';
  const lower = description.toLowerCase();
  const value = parseNumber(row['Valor']) || 0;
  const iso = parseDateBr(row['Data']);
  const date = new Date(`${iso}T12:00:00.000Z`);

  if (lower.includes('pagamento de fatura')) {
    return {
      category: 'Pagamento de fatura',
      paymentMethod: 'DEBIT',
      eventType: 'INVOICE_PAYMENT',
      isRecurring: false,
    };
  }
  if (
    description.startsWith('Aplicação RDB') ||
    description.startsWith('Resgate RDB') ||
    description.startsWith('Compra de Ações')
  ) {
    return {
      category: 'Investimentos',
      paymentMethod: 'INVESTMENT',
      eventType: null,
      isRecurring: false,
    };
  }
  if (lower.includes('lucas batista duarte')) {
    if (lower.includes('itaú') && value > 0) {
      return {
        category: 'Salário',
        paymentMethod: 'PIX',
        eventType: null,
        isRecurring: true,
      };
    }
    return {
      category: 'Transferência entre contas próprias',
      paymentMethod: 'TRANSFER',
      eventType: null,
      isRecurring: false,
    };
  }
  if (lower.includes('renata fernanda batista duarte')) {
    return {
      category: 'Família e amigos',
      paymentMethod: 'TRANSFER',
      eventType: 'REIMBURSEMENT',
      isRecurring: false,
    };
  }
  if (lower.includes('joao vitor batista duarte')) {
    return {
      category: 'Família e amigos',
      paymentMethod: 'TRANSFER',
      eventType: null,
      isRecurring: false,
    };
  }
  if (lower.includes('celio parreira duarte')) {
    if (value < 0) {
      return {
        category: 'Água',
        paymentMethod: 'PIX',
        eventType: null,
        isRecurring: false,
      };
    }
    return {
      category: 'Família e amigos',
      paymentMethod: 'TRANSFER',
      eventType: 'REIMBURSEMENT',
      isRecurring: false,
    };
  }
  if (lower.includes('thiago marcelo')) {
    return {
      category: 'Freelance',
      paymentMethod: 'PIX',
      eventType: null,
      isRecurring: true,
    };
  }
  if (
    lower.includes('consorcio zanetti') ||
    lower.includes('consorcio me caratinga')
  ) {
    return {
      category: 'Freelance',
      paymentMethod: 'PIX',
      eventType: null,
      isRecurring: true,
    };
  }
  if (lower.includes('construbello')) {
    return {
      category: 'Freelance',
      paymentMethod: 'PIX',
      eventType: null,
      isRecurring: true,
    };
  }
  if (lower.startsWith('reembolso recebido') || lower.includes('estorno')) {
    return {
      category: 'Reembolsos e estornos',
      paymentMethod: 'TRANSFER',
      eventType: 'REFUND',
      isRecurring: false,
    };
  }
  if (lower.includes('dtf estamparia') && value > 0) {
    return {
      category: 'Freelance',
      paymentMethod: 'TRANSFER',
      eventType: 'REFUND',
      isRecurring: false,
    };
  }
  if (lower.includes('irani da silva egydio coimbra')) {
    return {
      category: 'Transporte - Van',
      paymentMethod: 'PIX',
      eventType: null,
      isRecurring: true,
    };
  }
  if (lower.includes('disal')) {
    return {
      category: 'Veículo - Consórcio',
      paymentMethod: 'BOLETO',
      eventType: null,
      isRecurring: true,
    };
  }
  if (lower.includes('claro')) {
    return {
      category: 'Telefone/Internet',
      paymentMethod: 'BOLETO',
      eventType: null,
      isRecurring: true,
    };
  }
  if (lower.includes('empresa gontijo')) {
    return {
      category: 'Transporte - Ônibus',
      paymentMethod: 'PIX',
      eventType: null,
      isRecurring: false,
    };
  }
  if (
    lower.includes('99 food') ||
    lower.includes('99food') ||
    lower.includes('ifood') ||
    lower.includes('zé delivery') ||
    lower.includes('ze delivery')
  ) {
    return {
      category: 'Delivery',
      paymentMethod: lower.includes('transferência') ? 'PIX' : 'DEBIT',
      eventType: null,
      isRecurring: false,
    };
  }
  if (
    lower.includes('compra no débito via nupay - 99') ||
    lower.includes('compra no débito - 99')
  ) {
    return {
      category: 'Transporte - Extras',
      paymentMethod: 'DEBIT',
      eventType: null,
      isRecurring: false,
    };
  }
  if (
    lower.includes('baladapp') ||
    lower.includes('balada bilheteria') ||
    lower.includes('quero2ingressos')
  ) {
    return {
      category: 'Eventos e lazer',
      paymentMethod: 'PIX',
      eventType: null,
      isRecurring: false,
    };
  }
  if (
    lower.includes('acel estamparia') ||
    lower.includes('dtf estamparia')
  ) {
    return {
      category: 'Freelance - Insumos',
      paymentMethod: 'PIX',
      eventType: null,
      isRecurring: false,
    };
  }
  if (lower.includes('maia duarte') || lower.includes('claudia marcia')) {
    return {
      category: 'Saúde e farmácia',
      paymentMethod: 'PIX',
      eventType: null,
      isRecurring: false,
    };
  }
  if (lower.includes('flora las flores')) {
    return {
      category: 'Presentes',
      paymentMethod: 'PIX',
      eventType: null,
      isRecurring: false,
    };
  }
  if (lower.includes('editora cna') || lower.includes('livraria')) {
    return {
      category: 'Cursos e educação',
      paymentMethod: lower.includes('transferência') ? 'PIX' : 'DEBIT',
      eventType: null,
      isRecurring: false,
    };
  }
  if (lower.includes('casar.com')) {
    return {
      category: 'Presentes',
      paymentMethod: 'PIX',
      eventType: null,
      isRecurring: false,
    };
  }
  if (lower.includes('leroy merlin') || lower.includes('carbel')) {
    return {
      category: 'Casa e utilidades',
      paymentMethod: 'PIX',
      eventType: null,
      isRecurring: false,
    };
  }
  if (lower.includes('zakat') || lower.includes('barbearia')) {
    return {
      category: 'Barbearia e estética',
      paymentMethod: lower.includes('transferência') ? 'PIX' : 'DEBIT',
      eventType: null,
      isRecurring: false,
    };
  }
  if (lower.includes('jamal suplementos')) {
    return {
      category: 'Saúde e farmácia',
      paymentMethod: 'PIX',
      eventType: null,
      isRecurring: false,
    };
  }
  if (lower.includes('black phone')) {
    return {
      category: 'Tecnologia e eletrônicos',
      paymentMethod: 'PIX',
      eventType: null,
      isRecurring: false,
    };
  }
  if (lower.includes('drogaria')) {
    return {
      category: 'Saúde e farmácia',
      paymentMethod: 'DEBIT',
      eventType: null,
      isRecurring: false,
    };
  }
  if (lower.includes('renatalozada') || lower.includes('cappta')) {
    return {
      category: 'Vestuário',
      paymentMethod: 'DEBIT',
      eventType: null,
      isRecurring: false,
    };
  }
  if (lower.includes('daiso') || lower.includes('luyacomerciodeutil')) {
    return {
      category: 'Casa e utilidades',
      paymentMethod: 'DEBIT',
      eventType: null,
      isRecurring: false,
    };
  }
  if (lower.includes('nossa padoca')) {
    return {
      category: 'Padaria e lanches',
      paymentMethod: 'DEBIT',
      eventType: null,
      isRecurring: false,
    };
  }
  if (lower.includes('pizza para voce')) {
    return {
      category: 'Delivery',
      paymentMethod: 'PIX',
      eventType: null,
      isRecurring: false,
    };
  }
  if (lower.includes('fc delivery')) {
    return {
      category: 'Padaria e lanches',
      paymentMethod: 'PIX',
      eventType: null,
      isRecurring: false,
    };
  }
  if (lower.includes('casa torta')) {
    return {
      category: value < 0 ? 'Restaurantes e bares' : 'Freelance',
      paymentMethod: 'PIX',
      eventType: null,
      isRecurring: false,
    };
  }
  if (
    lower.includes('amazon com br') ||
    lower.includes('amazon.com.br') ||
    lower.includes('pix marketplace') ||
    lower.includes('pagar me')
  ) {
    return {
      category: 'Compras online',
      paymentMethod: 'PIX',
      eventType: null,
      isRecurring: false,
    };
  }
  if (lower.includes('deep6') || lower.includes('banlek')) {
    return {
      category: 'Assinaturas e serviços',
      paymentMethod: 'PIX',
      eventType: null,
      isRecurring: false,
    };
  }
  if (lower.includes('doze rackethouse')) {
    return {
      category: 'Eventos e lazer',
      paymentMethod: 'PIX',
      eventType: null,
      isRecurring: false,
    };
  }
  if (
    (lower.includes('vitoria segheto') ||
      lower.includes('jose daniel de oliveira') ||
      lower.includes('marcely sophia')) &&
    value < 0
  ) {
    return {
      category: 'Reembolsos e estornos',
      paymentMethod: 'TRANSFER',
      eventType: 'REFUND',
      isRecurring: false,
    };
  }

  const personalNames = [
    'pablo',
    'shayane',
    'magnum',
    'miguel',
    'anna luiza',
    'vinícius',
    'vinicius',
    'pedro augusto',
    'sara luci',
    'ully',
    'bruno henrique',
    'debora',
    'débora',
    'elton',
    'ronald',
    'rafael abras',
    'matheus',
    'maxwel',
    'joao francisco',
    'álvaro',
    'alvaro',
    'marcos',
    'cintia',
    'cíntia',
    'luiz fernando',
  ];
  if (personalNames.some((name) => lower.includes(name))) {
    return {
      category: 'Família e amigos',
      paymentMethod: 'TRANSFER',
      eventType: null,
      isRecurring: false,
    };
  }

  const businessWindow =
    date >= new Date('2026-02-01T12:00:00.000Z') &&
    date <= new Date('2026-05-31T12:00:00.000Z');
  if (businessWindow && value > 0) {
    const cents = Math.round(Math.abs(value) * 100) / 100;
    if (
      [70, 90, 140, 160, 180, 540, 810].includes(cents) ||
      cents >= 500
    ) {
      return {
        category: 'Freelance',
        paymentMethod: 'PIX',
        eventType: null,
        isRecurring: false,
      };
    }
  }
  if (
    value > 0 &&
    [70, 90].includes(Math.round(Math.abs(value) * 100) / 100) &&
    date >= new Date('2026-02-01T12:00:00.000Z')
  ) {
    return {
      category: 'Freelance',
      paymentMethod: 'PIX',
      eventType: null,
      isRecurring: false,
    };
  }
  if (
    value > 0 &&
    [60, 65, 80, 40, 12, 38, 35, 26, 15, 68, 50, 100, 220, 120, 1000, 28, 27.75, 33.5, 37.33, 11.5].includes(
      Math.round(Math.abs(value) * 100) / 100,
    )
  ) {
    return {
      category: 'Família e amigos',
      paymentMethod: 'TRANSFER',
      eventType: null,
      isRecurring: false,
    };
  }
  return {
    category: 'Outro',
    paymentMethod: 'PIX',
    eventType: null,
    isRecurring: false,
  };
}

function mapCard(row) {
  const title = row['title'] || '';
  const lower = title.toLowerCase();
  const rawAmount = parseNumber(row['amount']) || 0;
  const context = (row['Contexto_Financeiro'] || '').toLowerCase();
  const categoryHint = (row['Categoria'] || '').trim();
  const subcategoryHint = (row['Subcategoria'] || '').trim();

  if (context.includes('macbook')) return 'Tecnologia - MacBook';
  if (context.includes('iphone')) return 'Tecnologia - iPhone';
  if (context.includes('guarda-roupa')) return 'Casa - Guarda-roupa';
  if (context.includes('compra reembolsada')) return 'Casa - Compra reembolsada';
  if (context.includes('pai')) return 'Terceiros - Pai';
  if (context.includes('revenda') || context.includes('monitor')) return 'Revenda';
  if (context.includes('chile')) return 'Viagem - Chile';
  if (context.includes('ifood club')) return 'Assinaturas e serviços';
  if (context.includes('uber one')) return 'Transporte - Assinatura';

  // IOF lines are taxes/refunds, even when the merchant is Ollama/OpenAI/Udemy.
  if (lower.includes('iof de volta')) return 'Reembolsos e estornos';
  if (lower.includes('iof de') || lower === 'iof') return 'Impostos e IOF';

  // Positive "Estorno de ..." lines are re-charges of the original purchase,
  // not refunds. Keep them in the original merchant category.
  if (rawAmount > 0 && lower.includes('estorno de uber')) return 'Transporte - Extras';
  if (rawAmount > 0 && lower.includes('estorno de zé delivery')) return 'Delivery';
  if (rawAmount > 0 && lower.includes('estorno de apple')) return 'Assinaturas e serviços';
  if (rawAmount > 0 && lower.includes('estorno de shein')) return 'Vestuário';
  if (rawAmount > 0 && lower.includes('estorno de')) return 'Compras online';

  if (categoryHint === 'Transporte') {
    if (subcategoryHint === 'Casa → Trabalho') return 'Transporte - Casa/Trabalho';
    if (subcategoryHint === 'Trabalho → Namorada') return 'Transporte - Trabalho/Namorada';
    if (subcategoryHint === 'Trabalho → Casa (sexta)') return 'Transporte - Trabalho/Casa';
    if (subcategoryHint === 'Extra') return 'Transporte - Extras';
  }
  if (categoryHint === 'Alimentação') {
    return subcategoryHint.toLowerCase().includes('delivery')
      ? 'Delivery'
      : 'Restaurantes e bares';
  }
  if (categoryHint === 'Saúde/Fitness') return 'Academia';
  if (categoryHint === 'Tecnologia/IA') return 'IA e produtividade';
  if (categoryHint === 'Movimentação financeira') {
    return lower.includes('pagamento recebido')
      ? 'Pagamento de fatura'
      : 'Reembolsos e estornos';
  }
  if (lower.includes('pagamento recebido')) return 'Pagamento de fatura';
  if (lower.includes('shopee*raf imports')) return 'Tecnologia - MacBook';
  if (lower.includes('shopee *futuretech')) return 'Tecnologia - iPhone';
  if (lower.includes('shopee *panoramamoveis')) return 'Casa - Guarda-roupa';
  if (lower.includes('shopee*panorama mveis')) return 'Casa - Compra reembolsada';
  if (lower.includes('amazon br vi')) return 'Terceiros - Pai';
  if (lower.includes('amazon credito amz')) return 'Revenda';
  if (lower.includes('airbnb')) return 'Viagem - Chile';
  if (lower.includes('hotel')) return 'Viagem';
  if (
    /99\*|99negocia|99app|edi99|uber|uberrides|trip help/.test(lower)
  ) {
    return 'Transporte - Extras';
  }
  if (lower.includes('uber *one')) return 'Transporte - Assinatura';
  if (
    lower.includes('gontijo') ||
    lower.includes('viacao itauna') ||
    lower.includes('metro bh')
  ) {
    return 'Transporte - Ônibus';
  }
  if (
    lower.includes('99food') ||
    lower.includes('ifood') ||
    lower.includes('zé delivery') ||
    lower.includes('ze delivery') ||
    lower.includes('ifd*') ||
    lower.includes('mp *lanchonet') ||
    lower.includes('mp *dalinadesouza') ||
    lower.includes('mp *junior') ||
    lower.includes('mp *thebestacai') ||
    lower.includes('home party fast food')
  ) {
    return 'Delivery';
  }
  if (lower.includes('ifd*ifood club')) return 'Assinaturas e serviços';
  if (
    lower.includes('ifd*drogaria') ||
    lower.includes('drogaria') ||
    lower.includes('araujo')
  ) {
    return 'Saúde e farmácia';
  }
  if (
    lower.includes('supermercado') ||
    lower.includes('atacadao') ||
    lower.includes('atacarejao') ||
    lower.includes('sup epa') ||
    lower.includes('mart minas') ||
    lower.includes('piaza comercio')
  ) {
    return 'Supermercado';
  }
  if (
    lower.includes('padaria') ||
    lower.includes('pao fofo') ||
    lower.includes('nossa padoca') ||
    lower.includes('boca do forno') ||
    lower.includes('coffee') ||
    lower.includes('sorveteria') ||
    lower.includes('sorvetes') ||
    lower.includes('milky moo') ||
    lower.includes('kome') ||
    lower.includes('lanchesjr') ||
    lower.includes('viny lanches') ||
    lower.includes('rodosnack') ||
    lower.includes('bobs')
  ) {
    return 'Padaria e lanches';
  }
  if (lower.includes('barbearia')) return 'Barbearia e estética';
  if (
    lower.includes('outback') ||
    lower.includes('pizza') ||
    lower.includes('burger') ||
    lower.includes('bar') ||
    lower.includes('restaurante') ||
    lower.includes('rest ') ||
    lower.includes('subway') ||
    lower.includes('coreu') ||
    lower.includes('estripulia') ||
    lower.includes('dex') ||
    lower.includes('popin') ||
    lower.includes('frizzapizza') ||
    lower.includes('kirangao') ||
    lower.includes('tropeiro') ||
    lower.includes('churrasc')
  ) {
    return 'Restaurantes e bares';
  }
  if (
    lower.includes('cacau show') ||
    lower.includes('floresbella') ||
    lower.includes('oliveira presentes') ||
    lower.includes('babita') ||
    lower.includes('amora minas')
  ) {
    return 'Presentes';
  }
  if (
    lower.includes('leroy merlin') ||
    lower.includes('daiso') ||
    lower.includes('lifebox') ||
    lower.includes('nu galho') ||
    lower.includes('nugalho') ||
    lower.includes('cutecopo') ||
    lower.includes('purenestshop') ||
    lower.includes('autovascomulti') ||
    lower.includes('big servicos para fest')
  ) {
    return 'Casa e utilidades';
  }
  if (
    lower.includes('shein') ||
    lower.includes('renner') ||
    lower.includes('centauro') ||
    lower.includes('shopee *rosele') ||
    lower.includes('ruvolostore') ||
    lower.includes('shopee *3dfantasyii') ||
    lower.includes('renatalozada')
  ) {
    return 'Vestuário';
  }
  if (
    lower.includes('shopee *shpstecnologia') ||
    lower.includes('mercadolivre*clicktec')
  ) {
    return 'Tecnologia e eletrônicos';
  }
  if (
    lower.includes('shopee') ||
    lower.includes('aliexpress') ||
    lower.includes('mercadolivre') ||
    lower.includes('amazon') ||
    lower.includes('name-cheap')
  ) {
    return 'Compras online';
  }
  if (
    lower.includes('sympla') ||
    lower.includes('quero2ingressos') ||
    lower.includes('q2ingressos') ||
    lower.includes('night market') ||
    lower.includes('hops the town') ||
    lower.includes('air jump') ||
    lower.includes('rotary')
  ) {
    return 'Eventos e lazer';
  }
  if (
    lower.includes('wellhub') ||
    lower.includes('gympass') ||
    lower.includes('academia')
  ) {
    return 'Academia';
  }
  if (lower.includes('barbearia')) return 'Barbearia e estética';
  if (
    lower.includes('openai') ||
    lower.includes('ollama') ||
    lower.includes('anomaly')
  ) {
    return 'IA e produtividade';
  }
  if (
    lower.includes('linkedin') ||
    lower.includes('udemy') ||
    lower.includes('leituraitaushoppi')
  ) {
    return 'Cursos e educação';
  }
  if (
    lower.includes('google one') ||
    lower.includes('apple') ||
    lower.includes('amazonprime') ||
    lower.includes('netflix') ||
    lower.includes('spotify')
  ) {
    return 'Assinaturas e serviços';
  }
  if (lower.includes('numero esim')) return 'Telefone/Internet';
  if (lower.includes('nubank ultravioleta')) return 'Finanças e tarifas';
  if (lower.includes('iof')) return 'Impostos e IOF';
  if (lower.includes('dr bh')) return 'Saúde e farmácia';
  if (
    lower.includes('chill out') ||
    lower.includes('mineirao') ||
    lower.includes('unidadeitaupower') ||
    lower.includes('espetaculo') ||
    lower.includes('pop ')
  ) {
    return 'Restaurantes e bares';
  }
  if (
    lower.includes('matitapapelar') ||
    lower.includes('silva lobo') ||
    lower.includes('53410276sara') ||
    lower.includes('angela carla')
  ) {
    return 'Compras online';
  }
  if (
    lower.includes('mmbebidas') ||
    lower.includes('disk bebidas') ||
    lower.includes('efigeniacozinha')
  ) {
    return 'Delivery';
  }
  if (
    lower.includes('marllon') ||
    lower.includes('daniela de f') ||
    lower.includes('cebeeb') ||
    lower.includes('moeminha') ||
    lower.includes('cleiton') ||
    lower.includes('helton') ||
    lower.includes('leandro r campos') ||
    lower.includes('pedro douglas')
  ) {
    return 'Compras online';
  }
  return 'Outro';
}

// ---------------------------------------------------------------------------
// Seed construction
// ---------------------------------------------------------------------------

function parseInstallment(title) {
  const match = String(title).match(/Parcela\s*(\d+)\s*\/\s*(\d+)/i);
  if (!match) return null;
  return {
    number: Number(match[1]),
    total: Number(match[2]),
    base: String(title)
      .replace(/\s*-\s*Parcela\s*\d+\s*\/\s*\d+/i, '')
      .trim(),
  };
}

function buildFutureInstallments(cardGroups, cardId, walletId) {
  const future = [];
  for (const group of cardGroups.values()) {
    if (group.maxNumber >= group.total) continue;
    const last = group.items.find((item) => item.number === group.maxNumber);
    if (!last) continue;
    const lastDate = new Date(`${last.iso}T12:00:00.000Z`);
    for (let number = group.maxNumber + 1; number <= group.total; number++) {
      const step = number - group.maxNumber;
      const target = new Date(
        Date.UTC(
          lastDate.getUTCFullYear(),
          lastDate.getUTCMonth() + step,
          5,
          12,
          0,
          0,
          0,
        ),
      );
      future.push({
        transaction_date: target,
        wallet_id: walletId,
        card_id: cardId,
        transaction_type: 'EXPENSE',
        payment_method: 'CREDIT',
        description: `${group.base} - Parcela ${number}/${group.total}`,
        is_recurring: false,
        value: last.value,
        category_id: last.categoryId,
        installment_id: group.id,
        installment_total: group.total,
        installment_number: number,
        is_processed: false,
        subscription_id: null,
      });
    }
  }
  return future;
}

function buildFutureIncomes(nubankId, flashId, categoryIdByName) {
  const streams = [
    {
      name: 'Salário - 1ª parcela',
      value: 2031.43,
      day: 5,
      months: 13,
      category: 'Salário',
      paymentMethod: 'PIX',
      walletId: nubankId,
      eventType: null,
    },
    {
      name: 'Salário - 2ª parcela',
      value: 1600.0,
      day: 20,
      months: 13,
      category: 'Salário',
      paymentMethod: 'PIX',
      walletId: nubankId,
      eventType: null,
    },
    {
      name: 'Zanetti',
      value: 505.0,
      day: 10,
      months: 13,
      category: 'Freelance',
      paymentMethod: 'PIX',
      walletId: nubankId,
      eventType: null,
    },
    {
      name: 'Construbello',
      value: 350.0,
      day: 9,
      months: 13,
      category: 'Freelance',
      paymentMethod: 'PIX',
      walletId: nubankId,
      eventType: null,
    },
    {
      name: 'Thiago Marcelo',
      value: 200.0,
      day: 27,
      months: 13,
      category: 'Freelance',
      paymentMethod: 'PIX',
      walletId: nubankId,
      eventType: null,
    },
    {
      name: 'Zanetti Almoxarife',
      value: 280.0,
      day: 10,
      months: 13,
      category: 'Freelance',
      paymentMethod: 'PIX',
      walletId: nubankId,
      eventType: null,
    },
    {
      name: 'Zanetti Almoxarife (extra temporário)',
      value: 133.33,
      day: 10,
      months: 12,
      category: 'Freelance',
      paymentMethod: 'PIX',
      walletId: nubankId,
      eventType: null,
    },
    {
      name: 'Thiago Marcelo (extra temporário)',
      value: 375.0,
      day: 27,
      months: 4,
      category: 'Freelance',
      paymentMethod: 'PIX',
      walletId: nubankId,
      eventType: null,
    },
    {
      name: 'Benefício Flash (VA)',
      value: 650.0,
      day: 5,
      months: 13,
      category: 'Benefícios (VA/Flash)',
      paymentMethod: 'TRANSFER',
      walletId: flashId,
      eventType: 'BENEFIT',
    },
    {
      name: 'Reembolso Van (mãe)',
      value: 200.0,
      day: 10,
      months: 13,
      category: 'Reembolsos e estornos',
      paymentMethod: 'PIX',
      walletId: nubankId,
      eventType: 'REIMBURSEMENT',
    },
  ];

  const rows = [];
  for (const stream of streams) {
    for (let index = 0; index < stream.months; index++) {
      const target = new Date(
        Date.UTC(2026, 10 + index, stream.day, 12, 0, 0, 0),
      );
      const iso = isoDate(target);
      rows.push({
        transaction_date: target,
        wallet_id: stream.walletId,
        card_id: null,
        transaction_type: 'INCOME',
        payment_method: stream.paymentMethod,
        description: `${stream.name} - previsto ${iso.slice(0, 7)}`,
        is_recurring: true,
        value: stream.value,
        category_id: categoryIdByName.get(stream.category),
        installment_id: null,
        installment_total: null,
        installment_number: null,
        is_processed: false,
        subscription_id: null,
      });
    }
  }
  return rows;
}

function buildSubscriptions(nubankId, cardId, categoryIdByName) {
  const defs = [
    {
      name: 'Claro',
      value: 49.9,
      frequency: 'MONTHLY',
      next: '2026-11-14',
      category: 'Telefone/Internet',
      paymentMethod: 'BOLETO',
      card: false,
    },
    {
      name: 'DISAL - Consórcio',
      value: 1060.24,
      frequency: 'MONTHLY',
      next: '2026-11-05',
      category: 'Veículo - Consórcio',
      paymentMethod: 'BOLETO',
      card: false,
    },
    {
      name: 'Van Irani',
      value: 400.0,
      frequency: 'MONTHLY',
      next: '2026-11-09',
      category: 'Transporte - Van',
      paymentMethod: 'PIX',
      card: false,
    },
    {
      name: 'Água (Celio)',
      value: 140.0,
      frequency: 'MONTHLY',
      next: '2026-11-10',
      category: 'Água',
      paymentMethod: 'PIX',
      card: false,
    },
    {
      name: 'Wellhub',
      value: 82.4,
      frequency: 'MONTHLY',
      next: '2026-11-06',
      category: 'Academia',
      paymentMethod: 'CREDIT',
      card: true,
    },
    {
      name: 'Ollama',
      value: 115.24,
      frequency: 'MONTHLY',
      next: '2026-11-27',
      category: 'IA e produtividade',
      paymentMethod: 'CREDIT',
      card: true,
    },
    {
      name: 'Nubank Ultravioleta',
      value: 89.0,
      frequency: 'MONTHLY',
      next: '2026-11-11',
      category: 'Finanças e tarifas',
      paymentMethod: 'CREDIT',
      card: true,
    },
    {
      name: 'Barbearia Raylander',
      value: 50.0,
      frequency: 'MONTHLY',
      next: '2026-11-11',
      category: 'Barbearia e estética',
      paymentMethod: 'CREDIT',
      card: true,
    },
    {
      name: 'Google One',
      value: 23.99,
      frequency: 'MONTHLY',
      next: '2026-11-23',
      category: 'Assinaturas e serviços',
      paymentMethod: 'CREDIT',
      card: true,
    },
    {
      name: 'Amazon Prime',
      value: 19.9,
      frequency: 'MONTHLY',
      next: '2026-11-07',
      category: 'Assinaturas e serviços',
      paymentMethod: 'CREDIT',
      card: true,
    },
    {
      name: 'iFood Club',
      value: 7.95,
      frequency: 'MONTHLY',
      next: '2026-11-09',
      category: 'Assinaturas e serviços',
      paymentMethod: 'CREDIT',
      card: true,
    },
    {
      name: 'Uber One',
      value: 129.0,
      frequency: 'YEARLY',
      next: '2027-05-02',
      category: 'Transporte - Assinatura',
      paymentMethod: 'CREDIT',
      card: true,
    },
    {
      name: 'Apple iCloud',
      value: 5.9,
      frequency: 'MONTHLY',
      next: '2026-11-07',
      category: 'Assinaturas e serviços',
      paymentMethod: 'CREDIT',
      card: true,
    },
  ];

  return defs.map((def) => {
    const next = dateAtNoon(def.next);
    const categoryId = categoryIdByName.get(def.category);
    return {
      user_id: 0,
      wallet_id: nubankId,
      category_id: categoryId,
      name: def.name,
      description: `Recorrência importada do planejamento financeiro (${def.category})`,
      value: def.value,
      transaction_type: 'EXPENSE',
      frequency: def.frequency,
      status: 'ACTIVE',
      start_date: next,
      next_billing_date: next,
      payment_method: def.paymentMethod,
      icon: CATEGORY_DEFS.find(([name]) => name === def.category)?.[1] || null,
      card_id: def.card ? cardId : null,
    };
  });
}

// ---------------------------------------------------------------------------
// Database helpers
// ---------------------------------------------------------------------------

async function ensureUser(tx) {
  let user = await tx.user.findFirst({
    where: { username: 'lucasbatistasuarte' },
  });
  if (!user) user = await tx.user.findFirst({ orderBy: { id: 'asc' } });
  if (!user) throw new Error('Nenhum usuário encontrado no banco de produção.');
  return user;
}

async function ensureCategories(tx, userId) {
  const existing = await tx.transactionCategory.findMany({
    where: { user_id: userId },
  });
  const byName = new Map(existing.map((category) => [category.name, category]));
  for (const [name, icon] of CATEGORY_DEFS) {
    if (!byName.has(name)) {
      const created = await tx.transactionCategory.create({
        data: { user_id: userId, name, icon },
      });
      byName.set(name, created);
    } else if (!byName.get(name).icon) {
      await tx.transactionCategory.update({
        where: { id: byName.get(name).id },
        data: { icon },
      });
    }
  }
  return new Map([...byName.entries()].map(([name, category]) => [name, category.id]));
}

async function ensureWallets(tx, userId) {
  let nubank = await tx.wallet.findFirst({
    where: { user_id: userId, name: 'Nubank' },
  });
  if (!nubank) {
    nubank = await tx.wallet.create({
      data: {
        user_id: userId,
        name: 'Nubank',
        type: 'BANK',
        actual_cash: 0,
        order: 0,
      },
    });
  }
  await tx.wallet.update({
    where: { id: nubank.id },
    data: { type: 'BANK', actual_cash: 4120.0, order: 0 },
  });

  let flash = await tx.wallet.findFirst({
    where: { user_id: userId, name: 'Flash' },
  });
  if (!flash) {
    flash = await tx.wallet.create({
      data: {
        user_id: userId,
        name: 'Flash',
        type: 'MEAL_VOUCHER',
        actual_cash: 551.3,
        order: 1,
      },
    });
  } else {
    await tx.wallet.update({
      where: { id: flash.id },
      data: { type: 'MEAL_VOUCHER', actual_cash: 551.3, order: 1 },
    });
  }

  return { nubank, flash };
}

async function ensureCard(tx, walletId) {
  let card = await tx.card.findFirst({
    where: { wallet_id: walletId, name: 'Nubank Ultravioleta' },
  });
  if (!card) {
    card = await tx.card.create({
      data: {
        wallet_id: walletId,
        name: 'Nubank Ultravioleta',
        flag: 'Mastercard',
        closing_day: 4,
        due_day: 10,
        card_limit: 20000,
        usable_limit: 20000,
      },
    });
  } else {
    await tx.card.update({
      where: { id: card.id },
      data: {
        flag: 'Mastercard',
        closing_day: 4,
        due_day: 10,
        card_limit: 20000,
        usable_limit: 20000,
      },
    });
  }
  return card;
}

async function insertInChunks(tx, model, rows, chunkSize = 400) {
  for (let index = 0; index < rows.length; index += chunkSize) {
    await tx[model].createMany({ data: rows.slice(index, index + chunkSize) });
  }
}

async function computeCardInvoice(tx, cardId, closingDay = 4) {
  const today = AS_OF;
  let openCloseDate = new Date(
    Date.UTC(
      today.getUTCFullYear(),
      today.getUTCMonth(),
      closingDay,
      23,
      59,
      59,
      999,
    ),
  );
  if (today.getUTCDate() >= closingDay) {
    openCloseDate = new Date(
      Date.UTC(
        today.getUTCFullYear(),
        today.getUTCMonth() + 1,
        closingDay,
        23,
        59,
        59,
        999,
      ),
    );
  }
  const openStartDate = new Date(openCloseDate);
  openStartDate.setUTCMonth(openStartDate.getUTCMonth() - 1);
  openStartDate.setUTCHours(0, 0, 0, 0);
  const closedCloseDate = new Date(openStartDate.getTime() - 1);

  const [pastExpenses, allIncomes, currentExpenses, totalExpenses, totalIncomes] =
    await Promise.all([
      tx.transaction.aggregate({
        where: {
          card_id: cardId,
          transaction_type: 'EXPENSE',
          payment_method: 'CREDIT',
          transaction_date: { lte: closedCloseDate },
        },
        _sum: { value: true },
      }),
      tx.transaction.aggregate({
        where: {
          card_id: cardId,
          transaction_type: 'INCOME',
          payment_method: 'CREDIT',
        },
        _sum: { value: true },
      }),
      tx.transaction.aggregate({
        where: {
          card_id: cardId,
          transaction_type: 'EXPENSE',
          payment_method: 'CREDIT',
          transaction_date: { gte: openStartDate, lte: openCloseDate },
        },
        _sum: { value: true },
      }),
      tx.transaction.aggregate({
        where: {
          card_id: cardId,
          transaction_type: 'EXPENSE',
          payment_method: 'CREDIT',
        },
        _sum: { value: true },
      }),
      tx.transaction.aggregate({
        where: {
          card_id: cardId,
          transaction_type: 'INCOME',
          payment_method: 'CREDIT',
        },
        _sum: { value: true },
      }),
    ]);

  const past = Number(pastExpenses._sum.value || 0);
  const incomes = Number(allIncomes._sum.value || 0);
  const current = Number(currentExpenses._sum.value || 0);
  const totalExpense = Number(totalExpenses._sum.value || 0);
  const totalIncome = Number(totalIncomes._sum.value || 0);
  const due = Math.max(0, past - incomes);
  const remainingIncomes = Math.max(0, incomes - past);
  const currentInvoice = Math.max(0, current - remainingIncomes);
  const totalInvoice = totalExpense - totalIncome;
  return {
    due,
    currentInvoice,
    totalInvoice,
    committedLimit: Math.max(0, totalInvoice),
    availableLimit: 20000 - Math.max(0, totalInvoice),
    openStartDate,
    openCloseDate,
    closedCloseDate,
    past,
    incomes,
    current,
    totalExpense,
    totalIncome,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const accountRows = readCsvObjects(path.join(CSV_DIR, ACCOUNT_CSV));
  const cardRows = readCsvObjects(path.join(CSV_DIR, CARD_CSV));
  if (accountRows.length !== 463) {
    throw new Error(`Esperava 463 linhas na conta, encontrei ${accountRows.length}.`);
  }
  if (cardRows.length !== 1075) {
    throw new Error(`Esperava 1075 linhas no cartão, encontrei ${cardRows.length}.`);
  }

  const counts = await Promise.all([
    prisma.transaction.count(),
    prisma.card.count(),
    prisma.subscription.count(),
    prisma.budget.count(),
  ]);
  if (!ALLOW_NONEMPTY && counts.some((count) => count > 0)) {
    throw new Error(
      `O banco de destino não está vazio (transações=${counts[0]}, cartões=${counts[1]}, recorrências=${counts[2]}, orçamentos=${counts[3]}). Abortando para não duplicar dados.`,
    );
  }

  const run = async (tx) => {
    await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(728394651)');

    const user = await ensureUser(tx);
    const categoryIdByName = await ensureCategories(tx, user.id);
    const { nubank, flash } = await ensureWallets(tx, user.id);
    const card = await ensureCard(tx, nubank.id);

    const accountTransactions = [];
    const unmappedAccount = [];
    for (const row of accountRows) {
      const rawValue = parseNumber(row['Valor']);
      if (rawValue === null || rawValue === 0) continue;
      const iso = parseDateBr(row['Data']);
      if (!iso) continue;
      const mapping = mapAccount(row);
      if (mapping.category === 'Outro') {
        unmappedAccount.push({
          date: iso,
          value: rawValue,
          description: shortAccountDescription(row['Descrição']),
        });
      }
      const categoryId = categoryIdByName.get(mapping.category);
      if (!categoryId) throw new Error(`Categoria não encontrada: ${mapping.category}`);
      const description = shortAccountDescription(row['Descrição']);
      accountTransactions.push({
        transaction_date: dateAtNoon(iso),
        wallet_id: nubank.id,
        card_id: null,
        transaction_type: rawValue < 0 ? 'EXPENSE' : 'INCOME',
        payment_method: mapping.paymentMethod,
        description,
        is_recurring: mapping.isRecurring,
        value: Math.abs(rawValue),
        category_id: categoryId,
        installment_id: null,
        installment_total: null,
        installment_number: null,
        is_processed: dateAtNoon(iso) <= AS_OF,
        subscription_id: null,
      });
    }

    // The monitor was bought for resale and sold for ~R$977. The sale income is
    // not in the Nubank CSV, so record it explicitly to keep the net impact ~R$2.
    accountTransactions.push({
      transaction_date: dateAtNoon('2026-09-30'),
      wallet_id: nubank.id,
      card_id: null,
      transaction_type: 'INCOME',
      payment_method: 'PIX',
      description: 'Venda do monitor (revenda)',
      is_recurring: false,
      value: 977.0,
      category_id: categoryIdByName.get('Revenda'),
      installment_id: null,
      installment_total: null,
      installment_number: null,
      is_processed: true,
      subscription_id: null,
    });

    const cardTransactions = [];
    const cardGroups = new Map();
    const skippedCard = [];
    const unmappedCard = [];
    for (const row of cardRows) {
      const rawValue = parseNumber(row['amount']);
      if (rawValue === null || rawValue === 0) continue;
      const iso = parseDateAny(row['date']);
      if (!iso) continue;
      const title = row['title'] || '';
      const lowerTitle = title.toLowerCase();
      const paymentReceived = lowerTitle.includes('pagamento recebido');
      if (paymentReceived && Math.abs(Math.abs(rawValue) - 739.85) < 0.01) {
        skippedCard.push({ date: iso, value: rawValue, title, reason: 'fatura anterior à janela' });
        continue;
      }
      const category = mapCard(row);
      if (category === 'Outro') {
        unmappedCard.push({ date: iso, value: rawValue, title });
      }
      const categoryId = categoryIdByName.get(category);
      if (!categoryId) throw new Error(`Categoria não encontrada: ${category}`);
      const installment = parseInstallment(title);
      let groupKey = null;
      let groupId = null;
      if (installment) {
        groupKey = `${installment.base.toLowerCase()}|${installment.total}`;
        groupId = `seed-inst-${sha1(groupKey)}`;
      }
      let eventType = null;
      if (paymentReceived) eventType = 'INVOICE_PAYMENT';
      else if (/estorno|crédito|credito|desconto antecipação/i.test(title)) eventType = 'REFUND';
      else if (/amazon br vi/i.test(title)) eventType = 'THIRD_PARTY';
      else if (/amazon credito amz/i.test(title)) eventType = 'RESALE';
      else if (/nubank ultravioleta/i.test(title)) eventType = 'FEE';
      else if (/airbnb/i.test(title)) eventType = 'TRAVEL';

      const description = paymentReceived
        ? 'Pagamento recebido - Nubank Ultravioleta'
        : title;
      const transaction = {
        transaction_date: dateAtNoon(iso),
        wallet_id: nubank.id,
        card_id: card.id,
        transaction_type: rawValue < 0 ? 'INCOME' : 'EXPENSE',
        payment_method: 'CREDIT',
        description,
        is_recurring: false,
        value: Math.abs(rawValue),
        category_id: categoryId,
        installment_id: groupId,
        installment_total: installment ? installment.total : null,
        installment_number: installment ? installment.number : null,
        is_processed: dateAtNoon(iso) <= AS_OF,
        subscription_id: null,
      };
      cardTransactions.push(transaction);

      if (installment) {
        if (!cardGroups.has(groupKey)) {
          cardGroups.set(groupKey, {
            key: groupKey,
            id: groupId,
            base: installment.base,
            total: installment.total,
            maxNumber: 0,
            items: [],
          });
        }
        const group = cardGroups.get(groupKey);
        group.items.push({
          number: installment.number,
          iso,
          value: Math.abs(rawValue),
          categoryId,
        });
        group.maxNumber = Math.max(group.maxNumber, installment.number);
      }
    }

    // The production schema has no event_type/financial_event_id. The old
    // dashboard excludes invoice movements by description ("Pagamento de
    // fatura" / "Pagamento recebido"), so the descriptions below are the
    // contract with the running app.
    const accountInvoiceRows = accountTransactions.filter((transaction) =>
      String(transaction.description || '').startsWith('Pagamento de fatura'),
    );
    const cardPaymentRows = cardTransactions.filter((transaction) =>
      String(transaction.description || '').startsWith('Pagamento recebido'),
    );
    if (accountInvoiceRows.length !== 15) {
      throw new Error(
        `Esperava 15 pagamentos de fatura na conta, encontrei ${accountInvoiceRows.length}.`,
      );
    }
    if (cardPaymentRows.length !== 17) {
      throw new Error(
        `Esperava 17 pagamentos recebidos no cartão, encontrei ${cardPaymentRows.length}.`,
      );
    }

    const futureInstallments = buildFutureInstallments(
      cardGroups,
      card.id,
      nubank.id,
    );
    cardTransactions.push(...futureInstallments);

    const futureIncomes = buildFutureIncomes(
      nubank.id,
      flash.id,
      categoryIdByName,
    );

    const subscriptions = buildSubscriptions(
      nubank.id,
      card.id,
      categoryIdByName,
    ).map((subscription) => ({ ...subscription, user_id: user.id }));

    await insertInChunks(tx, 'transaction', accountTransactions);
    await insertInChunks(tx, 'transaction', cardTransactions);
    await insertInChunks(tx, 'transaction', futureIncomes);
    await insertInChunks(tx, 'subscription', subscriptions);

    // Explicit snapshots after the historical import. Historical cash flow in the
    // Nubank statement is net ~zero, so the informed current balance is the
    // opening balance as well.
    await tx.wallet.update({
      where: { id: nubank.id },
      data: { actual_cash: 4120.0 },
    });
    await tx.wallet.update({
      where: { id: flash.id },
      data: { actual_cash: 551.3 },
    });

    // ------------------------- assertions -------------------------
    const totalTransactions = await tx.transaction.count();
    const expectedTransactions =
      accountTransactions.length + cardTransactions.length + futureIncomes.length;
    if (totalTransactions !== expectedTransactions) {
      throw new Error(
        `Contagem de transações divergente: ${totalTransactions} != ${expectedTransactions}.`,
      );
    }
    if (skippedCard.length !== 1) {
      throw new Error(`Esperava exatamente 1 linha de cartão ignorada, encontrei ${skippedCard.length}.`);
    }
    if (futureInstallments.length !== 48) {
      throw new Error(`Esperava 48 parcelas futuras, encontrei ${futureInstallments.length}.`);
    }
    if (futureIncomes.length !== 120) {
      throw new Error(`Esperava 120 transações futuras de receita, encontrei ${futureIncomes.length}.`);
    }
    if (subscriptions.length !== 13) {
      throw new Error(`Esperava 13 recorrências, encontrei ${subscriptions.length}.`);
    }

    const pastUnprocessed = await tx.transaction.count({
      where: { is_processed: false, transaction_date: { lte: AS_OF } },
    });
    if (pastUnprocessed !== 0) {
      throw new Error(`Existem ${pastUnprocessed} transações não processadas com data passada.`);
    }

    const invoiceRows = await tx.transaction.findMany({
      where: {
        OR: [
          { description: { startsWith: 'Pagamento de fatura' } },
          { description: { startsWith: 'Pagamento recebido' } },
        ],
      },
      select: { description: true, transaction_type: true },
    });
    const accountInvoiceCount = invoiceRows.filter(
      (row) => String(row.description || '').startsWith('Pagamento de fatura'),
    ).length;
    const cardPaymentCount = invoiceRows.filter(
      (row) => String(row.description || '').startsWith('Pagamento recebido'),
    ).length;
    if (accountInvoiceCount !== 15 || cardPaymentCount !== 17) {
      throw new Error(
        `Pagamentos de fatura inválidos: conta=${accountInvoiceCount}, cartão=${cardPaymentCount}.`,
      );
    }

    const invoice = await computeCardInvoice(tx, card.id, 4);
    if (invoice.due > 0.01) {
      throw new Error(`Fatura fechada deveria ser zero, encontrei ${money(invoice.due)}.`);
    }
    if (Math.abs(invoice.currentInvoice - 4413.89) > 0.05) {
      throw new Error(
        `Fatura aberta divergente: ${money(invoice.currentInvoice)} (esperado 4413.89).`,
      );
    }
    if (Math.abs(invoice.totalInvoice - 11362.63) > 0.10) {
      throw new Error(
        `Fatura total divergente: ${money(invoice.totalInvoice)} (esperado 11362.63).`,
      );
    }
    if (invoice.availableLimit < 0) {
      throw new Error('Limite disponível negativo.');
    }

    const nubankAfter = await tx.wallet.findUnique({ where: { id: nubank.id } });
    const flashAfter = await tx.wallet.findUnique({ where: { id: flash.id } });
    if (Number(nubankAfter.actual_cash) !== 4120) {
      throw new Error(`Saldo Nubank divergente: ${nubankAfter.actual_cash}.`);
    }
    if (Math.abs(Number(flashAfter.actual_cash) - 551.3) > 0.001) {
      throw new Error(`Saldo Flash divergente: ${flashAfter.actual_cash}.`);
    }

    const dbSubscriptions = await tx.subscription.findMany({
      orderBy: { next_billing_date: 'asc' },
    });
    if (
      dbSubscriptions.length !== 13 ||
      dbSubscriptions.some((subscription) => new Date(subscription.next_billing_date) <= AS_OF)
    ) {
      throw new Error('Recorrências inválidas ou com próxima cobrança no passado.');
    }

    const categoryCounts = await tx.transaction.groupBy({
      by: ['category_id', 'transaction_type'],
      _count: { id: true },
      _sum: { value: true },
    });
    const categoryNameById = new Map(
      (await tx.transactionCategory.findMany()).map((category) => [
        category.id,
        category.name,
      ]),
    );

    const report = {
      user: { id: user.id, username: user.username },
      wallets: {
        nubank: { id: nubank.id, balance: 4120.0 },
        flash: { id: flash.id, balance: 551.3 },
      },
      card: {
        id: card.id,
        closingDay: 4,
        dueDay: 10,
        limit: 20000,
      },
      counts: {
        accountCsvRows: accountRows.length,
        accountImported: accountTransactions.length,
        cardCsvRows: cardRows.length,
        cardImported: cardTransactions.length - futureInstallments.length,
        cardSkipped: skippedCard.length,
        futureInstallments: futureInstallments.length,
        futureIncomes: futureIncomes.length,
        subscriptions: subscriptions.length,
        totalTransactions,
      },
      invoice: {
        due: Number(invoice.due.toFixed(2)),
        current: Number(invoice.currentInvoice.toFixed(2)),
        total: Number(invoice.totalInvoice.toFixed(2)),
        availableLimit: Number(invoice.availableLimit.toFixed(2)),
      },
      unmappedAccount,
      unmappedCard,
      skippedCard,
      categories: categoryCounts
        .map((row) => ({
          name: categoryNameById.get(row.category_id) || `#${row.category_id}`,
          type: row.transaction_type,
          count: row._count.id,
          sum: Number((row._sum.value || 0).toFixed(2)),
        }))
        .sort((a, b) => a.name.localeCompare(b.name) || a.type.localeCompare(b.type)),
      subscriptions: dbSubscriptions.map((subscription) => ({
        name: subscription.name,
        value: Number(subscription.value),
        frequency: subscription.frequency,
        next: isoDate(new Date(subscription.next_billing_date)),
        paymentMethod: subscription.payment_method,
        cardId: subscription.card_id,
      })),
    };

    console.log(JSON.stringify(report, null, 2));

    if (DRY_RUN) {
      const error = new Error('DRY_RUN_ROLLBACK');
      error.dryRun = true;
      throw error;
    }
  };

  try {
    await prisma.$transaction(run, {
      timeout: 300000,
      maxWait: 30000,
      isolationLevel: 'Serializable',
    });
    console.log('\nSeed concluído com COMMIT.');
  } catch (error) {
    if (error && error.dryRun) {
      console.log('\nDRY RUN concluído; transação revertida sem alterar o banco.');
      process.exitCode = 0;
      return;
    }
    throw error;
  }
}

main()
  .catch((error) => {
    console.error('\nFalha no seed:', error.message);
    if (error.stack) console.error(error.stack);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
