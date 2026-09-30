// Segment first so skin tones, flags, keycaps and joined families stay together.
// Older streaming-program browsers may not provide Intl.Segmenter or Unicode properties.
window.ChatEmojiParser=(()=>{
 const aliases={
  smile:'🙂',happy:'😄',angry:'😠',cry:'😢',embarrassed:'😳',surprised:'😲',wronged:'🥺',shout:'😫',flushed:'😳',yummy:'😋',complacent:'😌',drool:'🤤',scream:'😱',weep:'😭',speechless:'😶',funnyface:'🤪',laughwithtears:'😂',wicked:'😈',facewithrollingeyes:'🙄',sulk:'😒',thinking:'🤔',lovely:'🥰',greedy:'🤑',wow:'😮',joyful:'😊',hehe:'😏',slap:'😵',tears:'😭',stun:'😵',cute:'🥺',blink:'😉',disdain:'😤',astonish:'😲',rage:'😡',cool:'😎',excited:'🤩',proudface:'😏',smileface:'😀',evil:'👿',angel:'😇',laugh:'😂',pride:'😌',nap:'😴',loveface:'😍',awkward:'😅',shock:'😱',love:'😍',lol:'😂',rofl:'🤣',heart:'❤️',fire:'🔥'
 };
 const codePattern=/\[([a-z][a-z0-9_-]{1,31})\]/gi;
 function fallbackSegments(text){
  const points=Array.from(text),out=[];
  for(let i=0;i<points.length;i++){
   let value=points[i],code=value.codePointAt(0);
   if(code>=0x1f1e6&&code<=0x1f1ff&&i+1<points.length){const next=points[i+1].codePointAt(0);if(next>=0x1f1e6&&next<=0x1f1ff)value+=points[++i];}
   while(i+1<points.length){const next=points[i+1],n=next.codePointAt(0);if(n===0xfe0f||n===0x20e3||n>=0x1f3fb&&n<=0x1f3ff){value+=next;i++;continue;}if(n===0x200d&&i+2<points.length){value+=next+points[i+2];i+=2;continue;}break;}
   out.push(value);
  }
  return out;
 }
 function segments(text){try{if(Intl&&typeof Intl.Segmenter==='function')return Array.from(new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(text),s=>s.segment);}catch(_){}return fallbackSegments(text);}
 function isEmoji(value){
  try{return new RegExp('\\p{Extended_Pictographic}|\\p{Regional_Indicator}|\\u20e3','u').test(value);}catch(_){}
  return Array.from(value).some(char=>{const n=char.codePointAt(0);return n===0x20e3||n>=0x1f000&&n<=0x1faff||n>=0x2600&&n<=0x27ff||n>=0x1f1e6&&n<=0x1f1ff;});
 }
 function codeMatches(text){const matches=[];codePattern.lastIndex=0;let match;while((match=codePattern.exec(text)))matches.push({start:match.index,end:codePattern.lastIndex,raw:match[0],name:match[1].toLowerCase()});return matches;}
 function pointIndex(text,unitIndex){return Array.from(text.slice(0,unitIndex)).length;}
 function parts(text,emotes=[]){
  text=String(text==null?'':text);const matches=codeMatches(text),images=(Array.isArray(emotes)?emotes:[]).map((value,order)=>({value,order,used:false}));
  for(const image of images){const index=Number(image.value&&image.value.index),match=matches.find(candidate=>!candidate.image&&(index===candidate.start||index===pointIndex(text,candidate.start)));if(match){image.used=true;match.image=image.value;}}
  for(const image of images){if(image.used)continue;const match=matches.find(candidate=>!candidate.image&&aliases[candidate.name]);if(match){image.used=true;match.image=image.value;}}
  const out=[];let cursor=0;
  for(const match of matches){if(match.start>cursor)out.push({text:text.slice(cursor,match.start)});if(match.image)out.push({url:match.image.url,alt:match.image.id||match.name});else out.push({text:aliases[match.name]||match.raw});cursor=match.end;}
  if(cursor<text.length)out.push({text:text.slice(cursor)});for(const image of images)if(!image.used)out.push({url:image.value&&image.value.url,alt:image.value&&image.value.id||'Emoji de TikTok'});return out;
 }
 return {aliases,parts,expand(text){return parts(text).map(part=>part.text||'').join('');},extract(text,limit=6){const expanded=parts(text).map(part=>part.text||'').join('');return segments(expanded).filter(isEmoji).slice(0,limit);}};
})();
