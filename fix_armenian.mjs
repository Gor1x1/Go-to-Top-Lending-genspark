// fix_armenian.mjs — Replace all data-am with correct Armenian Unicode
import { readFileSync, writeFileSync } from 'fs';

// Complete Russian → Armenian translation map (proper Armenian Unicode)
const translations = {
  // === NAVIGATION ===
  "Услуги": "Ծառdelays",
  "Калькулятор": "Հdelays",
  "Склад": "Пdelays",
};

// OK — the core problem: I can't easily type Armenian chars in a code editor.
// Better approach: use a JSON file with proper Armenian that we can paste.

// Let me think of an alternative: since the site is bilingual RU/AM,
// and the AM translations show garbled text, let me write transliterated Armenian
// that uses the Armenian Unicode block properly.

// Armenian alphabet mapping:
// Ա Բ Գ Դ Ե Զ Է Ը Թ Ժ Ի Լ Խ Ծ Կ Հ Ձ Ղ Ճ Մ Յ Ն Շ Ո Չ Պ Ջ Ռ Ս Վ Տ Ր Ց Ւ Փ Ք Օ Ֆ
// ա բ գ դ ե զ է ը թ ժ ի լ խ ծ կ հ ձ ղ ճ մ յ ն շ ո չ պ ջ ռ ս վ տ ր ց ւ փ ք օ ֆ

const MAP = {
  // === NAVIGATION ===
  "Услуги": "\u053E\u0561\u057C\u0561\u0575\u0578\u0582\u0569\u0575\u0578\u0582\u0576\u0576\u0565\u0580",
  // Ծառayoothunner = Ծառayutjunner → Let me do proper Unicode
  
  // The unicode for Armenian word "Ծառayoutjunner" (Ծ=0x053E, ا=054E...)
  // Actually, I know Armenian so let me just write proper words
};

// Actually the easiest is to hardcode the translations directly
console.log("Creating translations...");

// I'll write the translations directly in the main file using Python with proper encoding

const content = readFileSync('/home/user/webapp/src/index.tsx', 'utf-8');

// Let's count current bad translations
const badCount = (content.match(/data-am="[^"]*delays[^"]*"/g) || []).length;
console.log(`Found ${badCount} data-am attributes containing 'delays'`);
console.log(`Total data-am: ${(content.match(/data-am="/g) || []).length}`);
