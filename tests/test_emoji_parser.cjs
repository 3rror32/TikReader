process.chdir(require('node:path').resolve(__dirname, '..'));
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),test=require('node:test');
const window={};vm.runInNewContext(fs.readFileSync('web/static/emoji_parser.js','utf8'),{window,Intl});
const extract=(s,n)=>Array.from(window.ChatEmojiParser.extract(s,n));
test('emoji clusters keep joined families, flags, skin tones and keycaps intact',()=>{
 assert.deepEqual(extract('hola 👨‍👩‍👧‍👦 🇲🇽 👍🏽 1️⃣ ❤️'),['👨‍👩‍👧‍👦','🇲🇽','👍🏽','1️⃣','❤️']);
 assert.deepEqual(extract('texto 123 <script>'),[]);
 assert.deepEqual(extract('😂😂😂',2),['😂','😂']);
});
test('emoji extraction works in older OBS browsers without Intl.Segmenter',()=>{
 const legacyWindow={};vm.runInNewContext(fs.readFileSync('web/static/emoji_parser.js','utf8'),{window:legacyWindow,Intl:{}});
 assert.deepEqual(Array.from(legacyWindow.ChatEmojiParser.extract('hola 👨‍👩‍👧‍👦 🇲🇽 👍🏽 1️⃣ ❤️',10)),['👨‍👩‍👧‍👦','🇲🇽','👍🏽','1️⃣','❤️']);
});
test('TikTok bracket reactions render as emoji instead of raw codes',()=>{
 assert.equal(window.ChatEmojiParser.expand('Eso fue genial [laugh] [wronged]'),'Eso fue genial 😂 🥺');
 assert.deepEqual(extract('[laugh] [loveface] [fire]',6),['😂','😍','🔥']);
 assert.equal(window.ChatEmojiParser.expand('texto [no-es-un-emoji]'),'texto [no-es-un-emoji]');
});
test('TikTok image emotes replace their bracket token at its original position',()=>{
 const parts=window.ChatEmojiParser.parts('hola [laugh] final',[{id:'laugh',index:5,url:'https://example.com/laugh.webp'}]);
 assert.deepEqual(JSON.parse(JSON.stringify(parts)),[{text:'hola '},{url:'https://example.com/laugh.webp',alt:'laugh'},{text:' final'}]);
});
