/* Shared by the voice preview and live reader. No text is added or rewritten. */
window.VoicePersonality = (() => {
  const styles = {
    padre: [
      {id:'classic',name:'Relajado',pitch:.72,rate:.88,expression:.07,description:'Grave y tranquilo, con ligeros cambios de tono.'},
      {id:'comic',name:'Remate cómico',pitch:.84,rate:.96,expression:.16,description:'Más juguetón; las exclamaciones suben el tono y el ritmo.'},
      {id:'sleepy',name:'Papá somnoliento',pitch:.62,rate:.72,expression:.04,description:'Más grave y lento, con una entonación suave.'}
    ],
    heroe: [
      {id:'classic',name:'Enérgico',pitch:1.42,rate:1.22,expression:.12,description:'Agudo y ágil, con más energía al exclamar.'},
      {id:'action',name:'En plena acción',pitch:1.58,rate:1.42,expression:.16,description:'Más rápido y brillante para anunciar la acción.'},
      {id:'confident',name:'Héroe confiado',pitch:1.16,rate:1.08,expression:.08,description:'Un tono más firme y un ritmo moderado.'}
    ],
    villano: [
      {id:'classic',name:'Dramático',pitch:.58,rate:.76,expression:.08,description:'Profundo y lento, con cambios de entonación contenidos.'},
      {id:'sinister',name:'Amenaza tranquila',pitch:.5,rate:.64,expression:.03,description:'Muy grave y deliberado, casi sin cambios de tono.'},
      {id:'grand',name:'Gran monólogo',pitch:.78,rate:.86,expression:.18,description:'Más teatral y expresivo en preguntas y exclamaciones.'}
    ],
    anciano: [
      {id:'classic',name:'Travieso',pitch:1.25,rate:.82,expression:.12,description:'Agudo y pausado, con una entonación juguetona.'},
      {id:'story',name:'Cuenta historias',pitch:1.08,rate:.72,expression:.07,description:'Más lento y cálido para contar anécdotas.'},
      {id:'mischief',name:'Bromista entusiasta',pitch:1.48,rate:.94,expression:.18,description:'Más alto y animado, con cambios de tono marcados.'}
    ],
    robot: [
      {id:'classic',name:'Cabina automática',pitch:.9,rate:1.3,expression:0,description:'Tono y velocidad constantes para una lectura uniforme.'},
      {id:'system',name:'Sistema central',pitch:.62,rate:1.02,expression:0,description:'Más grave y medido, sin variaciones expresivas.'},
      {id:'tiny',name:'Minirobot',pitch:1.65,rate:1.48,expression:0,description:'Agudo, rápido y uniforme.'}
    ]
  };
  function options(character) { return styles[character?.personality || character?.id] || []; }
  function resolve(character) {
    const choices=options(character);
    return choices.find(style=>style.id===character?.variation) || choices[0];
  }
  function apply(utterance, character, rate, random=Math.random) {
    const style=resolve(character), number=(value,fallback)=>Number.isFinite(Number(value))?Number(value):fallback;
    const expression=style?.expression || 0;
    const text=String(utterance.text || '');
    const emphasis=/[!¡]/.test(text)?1:/[?¿]/.test(text)?.5:0;
    const change=expression*((random()-.5)*.6+emphasis);
    utterance.pitch=Math.max(.5,Math.min(2,number(character?.pitch,1)+change));
    utterance.rate=Math.max(.5,Math.min(2,number(rate,character?.rate || 1)*(1+change*.4)));
  }
  return {options,resolve,apply};
})();
