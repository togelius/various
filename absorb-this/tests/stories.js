// Narrative consequences use the real incident/archive system, in the isolated game frame.
function testStories() {
 const out=[],oldTimer=window.setTimeout;window.setTimeout=()=>0;
 const check=(name,ok)=>{if(!ok)throw Error(name);out.push('PASS '+name);};
 try {
  reset();state='play';hideScreen();ZZ.lock=false;jokeT=0;zHide();ZZ.cool=0;
  const e=makeEnemy('sponge',P.x+2,P.z),b=makeEnemy('bottle',P.x+4,P.z);enemies=[e,b];
  kitchenIncident('property',{actor:e});
  check('A witnessed claim has a named claimant and a recorded explanation',kitchenStories.entries.length===1&&!!e.dramaTitle&&kitchenStories.entries[0].actor.includes('#'));
  const title=e.dramaTitle;
  kitchenIncident('redistribution',{actor:e,other:b});
  check('Redistribution remembers the same former property owner',kitchenStories.entries[1].callback==='fallenOwner'&&e.dramaTitle===title);
  kitchenStories.time+=7;kitchenIncident('launch',{actor:b});
  kitchenStories.time+=7;kitchenIncident('launch',{actor:b});
  check('Repeat elevation produces a callback rather than forgetting its subject',kitchenStories.entries.at(-1).callback==='repeatElevation');
  const before=kitchenStories.entries.length,storyTime=kitchenStories.time;
  state='dead';kitchenIncident('sauceFeud',{actor:e,other:b});updateKitchenStories(20);
  check('The death tableau cannot invent incidents or consume pending stories',kitchenStories.entries.length===before&&kitchenStories.time===storyTime);
  state='play';zShow('An existing joke is still speaking.');
  const pending=kitchenStories.pending.length;updateKitchenStories(1);
  check('Incidents do not cancel existing voiced jokes',ZZ.text==='An existing joke is still speaking.'&&kitchenStories.pending.length===pending);
  zHide();ZZ.cool=0;kitchenStories.nextVoice=0;const waiting=kitchenStories.pending[0].text;
  updateKitchenStories(0);
  check('A waiting incident gets a speaking turn after the host finishes',ZZ.on&&ZZ.text.includes(waiting));
  openNotebook();
  check('The notebook makes missed incident explanations readable',screenKind==='journal'&&$('scr').textContent.includes('MINUTES OF THE DISAGREEMENT')&&$('scr').textContent.includes(title));
  const frozen=kitchenStories.time;tick(1);
  check('Reading the proceedings freezes the living kitchen',kitchenStories.time===frozen);
  reset();state='play';const far=makeEnemy('sponge',P.x+100,P.z);
  kitchenIncident('property',{actor:far});
  check('Offscreen actors remember their behavior without false eyewitness reports',far.dramaHistory.property===1&&kitchenStories.entries.length===0);
  far.x=P.x+2;kitchenIncident('redistribution',{actor:far});
  check('An offscreen history can become a witnessed callback later',kitchenStories.entries[0].callback==='fallenOwner');
  for(let i=0;i<70;i++){kitchenStories.time+=7;kitchenIncident('sauceFeud',{actor:far});}
  check('An endless spill keeps bounded news and speech history',kitchenStories.entries.length===48&&kitchenStories.pending.length<=6);
  const malicious=makeEnemy('sponge',P.x+2,P.z);malicious.dramaTitle='<img src=x onerror=alert(1)>';
  kitchenStories.time+=7;kitchenIncident('property',{actor:malicious});
  check('The proceedings render actor labels as text',kitchenMinutesHTML().includes('&lt;img')&&!kitchenMinutesHTML().includes('<img'));
  reset();check('A new spill clears incidents but keeps the authored banks',kitchenStories.entries.length===0&&kitchenStories.serial===0&&Object.keys(KITCHEN_INCIDENTS).length>=7);
 }catch(e){out.push('FAIL '+e.message);}
 finally{window.setTimeout=oldTimer;reset();state='play';hideScreen();$('hud').classList.remove('off');}
 return out;
}
