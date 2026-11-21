const W = 1000, H = 760;
const CELL_W = 120, CELL_H = 160, GAP = 10;
const BOARD_X = 310, BOARD_Y = 130;
const HAND_W = 100, HAND_H = 133;
const FONT = '"Microsoft YaHei","SimHei","PingFang SC",sans-serif';

const DIRS = [
  { dx:0, dy:-1, side:'top' },
  { dx:-1, dy:0, side:'left' },
  { dx:1, dy:0, side:'right' },
  { dx:0, dy:1, side:'bottom' }
];
const OPP = { top:'bottom', left:'right', right:'left', bottom:'top' };

let G = null;
let board = [];
let handP = [], handA = [];
let turn = 'player';
let selected = null;
let aiTimer = 0;
let result = null;
let currentCfg = null;

function defaultG(){ return { big:1, small:1, pLevels:{ '刘备':1, '关羽':1, '张飞':1 } }; }

function migrateG(raw){
  if(!raw) return defaultG();
  if(typeof raw.big !== 'number') raw.big = 1;
  if(typeof raw.small !== 'number') raw.small = 1;
  if(!raw.pLevels) raw.pLevels = { '刘备':1, '关羽':1, '张飞':1 };
  return raw;
}

function enemyLevel(){ return 1; }
function cardAt(name, lvl){ lvl = Math.min(10, Math.max(1, lvl)); return JSON.parse(JSON.stringify(CARD_DATA[name][lvl-1])); }

function saveGame(){ try { localStorage.setItem('tt3k_save', JSON.stringify(G)); } catch(e){} }
function loadGame(){ try { return migrateG(JSON.parse(localStorage.getItem('tt3k_save'))); } catch(e){ return null; } }
function clearSave(){ try { localStorage.removeItem('tt3k_save'); } catch(e){} }

function levelConfig(small){
  if(small === 1) return { title:'第一大关：讨伐袁术', sub:'第一小关：徐州南面山寨', enemies:['纪灵','张勋','陈纪','雷薄','陈兰'] };
  if(small === 2) return { title:'第一大关：讨伐袁术', sub:'第二小关：南面山洞旁营寨', enemies:['纪灵','雷薄','陈兰','韩暹', (Math.random()<0.5?'张勋':'陈纪')] };
  return null;
}

function newMatch(){
  board = new Array(9).fill(null);
  currentCfg = levelConfig(G.small);
  if(!currentCfg){
    // all clear: reset to 1
    G.small = 1;
    currentCfg = levelConfig(1);
  }
  handP = [
    cardAt('刘备', G.pLevels['刘备']),
    cardAt('关羽', G.pLevels['关羽']),
    cardAt('张飞', G.pLevels['张飞']),
    cardAt('朱灵', enemyLevel()),
    cardAt('露昭', enemyLevel())
  ];
  handA = currentCfg.enemies.map(n=>cardAt(n, enemyLevel()));
  turn = 'player';
  selected = null;
  aiTimer = 0;
  result = null;
}

function score(owner){
  let s = 0;
  for(let i=0;i<9;i++){ if(board[i] && board[i].owner===owner) s++; }
  const hand = owner==='player' ? handP : handA;
  return s + hand.length;
}
function checkEnd(){
  let filled = 0;
  for(let i=0;i<9;i++){ if(board[i]) filled++; }
  if(filled === 9){
    const ps = score('player'), as = score('ai');
    if(ps > as) result = '你赢了!  ' + ps + ' : ' + as;
    else if(ps < as) result = '你输了...  ' + ps + ' : ' + as;
    else result = '平局  ' + ps + ' : ' + as;
    turn = 'over';
  }
}
function sideValue(card, side, cellIdx){ return card[side]; }
function placeCard(owner, handIdx, cellIdx){
  const hand = owner==='player' ? handP : handA;
  const card = hand[handIdx];
  hand.splice(handIdx, 1);
  board[cellIdx] = { card, owner, flash:0 };
  const col = cellIdx % 3;
  const row = Math.floor(cellIdx / 3);
  for(const d of DIRS){
    const nc = col + d.dx, nr = row + d.dy;
    if(nc>=0 && nc<=2 && nr>=0 && nr<=2){
      const ni = nr*3 + nc;
      const occ = board[ni];
      if(occ && occ.owner !== owner){
        const mine = sideValue(card, d.side, cellIdx);
        const theirs = sideValue(occ.card, OPP[d.side], ni);
        if(mine > theirs){ occ.owner = owner; occ.flash = 0.6; }
      }
    }
  }
  selected = null;
  checkEnd();
  return turn !== 'over';
}
function aiMove(){
  let best=null, bestScore=null;
  for(let hi=0; hi<handA.length; hi++){
    const card = handA[hi];
    for(let ci=0; ci<9; ci++){
      if(!board[ci]){
        let flips=0;
        const col=ci%3, row=Math.floor(ci/3);
        for(const d of DIRS){
          const nc=col+d.dx, nr=row+d.dy;
          if(nc>=0 && nc<=2 && nr>=0 && nr<=2){
            const ni=nr*3+nc;
            const occ=board[ni];
            if(occ && occ.owner==='player'){
              if(sideValue(card,d.side,ci) > sideValue(occ.card,OPP[d.side],ni)) flips++;
            }
          }
        }
        let defended=0;
        for(const d of DIRS){
          const nc=col+d.dx, nr=row+d.dy;
          if(nc<0 || nc>2 || nr<0 || nr>2){ defended++; }
          else {
            const ni=nr*3+nc;
            const occ=board[ni];
            if(occ && occ.owner==='ai') defended++;
            else if(occ && sideValue(occ.card,OPP[d.side],ni) >= sideValue(card,d.side,ci)) defended++;
          }
        }
        const s = flips*100 + defended*8 + Math.floor(Math.random()*9);
        if(bestScore===null || s>bestScore){ bestScore=s; best={hi,ci}; }
      }
    }
  }
  if(best){ placeCard('ai', best.hi, best.ci); }
}

function numText(v){ return v>=10 ? 'A' : String(v); }
function cellRect(i){ const col=i%3, row=Math.floor(i/3); return { x:BOARD_X+col*(CELL_W+GAP), y:BOARD_Y+row*(CELL_H+GAP), w:CELL_W, h:CELL_H }; }
function cellAt(mx,my){ for(let i=0;i<9;i++){ const r=cellRect(i); if(mx>=r.x&&mx<=r.x+r.w&&my>=r.y&&my<=r.y+r.h) return i;} return null; }

const MAX_SMALL = { 1: 2 };
function advanceOnWin(){
  const max = MAX_SMALL[G.big||1] || 2;
  if(G.small < max){
    G.small = G.small + 1;
  } else {
    // complete big level: upgrade protagonists
    for(const k in G.pLevels){ G.pLevels[k] = Math.min(10, G.pLevels[k]+1); }
    // stay at last small level
    G.small = max;
  }
  saveGame();
}

// ---- Intro Scene ----
class IntroScene extends Phaser.Scene {
  constructor(){ super('IntroScene'); }
  create(){
    this.cameras.main.setBackgroundColor('#0b140d');
    const g = this.add.graphics(); g.fillStyle(0x09140c,1); g.fillRect(0,0,W,H);
    this.add.text(W/2, 120, '吞食九州', {fontSize:'44px',color:'#9cf',fontFamily:FONT}).setOrigin(0.5,0);

    let y = 320;
    const save = loadGame();
    if(save){
      this.makeBtn(W/2, y, '继续游戏', ()=>{ G = save; this.scene.start('GameScene'); });
      y += 70;
    }
    this.makeBtn(W/2, y, '从新开始', ()=>{
      clearSave();
      G = defaultG();
      saveGame();
      this.scene.start('GameScene');
    });
  }
  makeBtn(x,y,label,cb){
    const btn = this.add.rectangle(x,y,220,50,0x1a2b62).setOrigin(0.5,0.5).setInteractive({useHandCursor:true});
    const t = this.add.text(x,y,label,{fontSize:'20px',color:'#fff',fontFamily:FONT}).setOrigin(0.5,0.5);
    btn.on('pointerover',()=>btn.setFillStyle(0x2a449d));
    btn.on('pointerout',()=>btn.setFillStyle(0x1a2b62));
    btn.on('pointerdown',cb);
    return btn;
  }
}

// ---- Game Scene ----
class GameScene extends Phaser.Scene {
  constructor(){ super('GameScene'); }
  create(){
    if(!G) { G = defaultG(); saveGame(); }
    this.cameras.main.setBackgroundColor('#0b140d');
    const bg = this.add.graphics(); bg.fillStyle(0x09140c,1); bg.fillRect(0,0,W,H);
    this.titleText = this.add.text(20,8,'',{fontSize:'16px',color:'#9cf',fontFamily:FONT});
    this.scoreAi = this.add.text(40,160,'',{fontSize:'18px',color:'#f44',fontFamily:FONT});
    this.scoreP = this.add.text(880,610,'',{fontSize:'18px',color:'#459',fontFamily:FONT});
    this.hint = this.add.text(20,34,'',{fontSize:'16px',color:'#fff',fontFamily:FONT});
    this.footer = this.add.text(20,H-22,'基本规则：数字大者翻面 | R = 重新开始 | ESC = 返回',{fontSize:'14px',color:'#b0bcb0',fontFamily:FONT});

    this.cellBg = [];
    for(let i=0;i<9;i++){
      const r = cellRect(i);
      const rect = this.add.rectangle(r.x,r.y,r.w,r.h,0x050a07).setOrigin(0,0);
      this.cellBg.push(rect);
    }
    this.boardCards = new Array(9).fill(null);
    this.selCellHl = [];
    this.playerHandC = [];
    this.aiHandC = [];
    this.overlayRefs = new Array(9).fill(null);

    // result overlay
    this.resultOverlay = this.add.container(0,0).setDepth(100).setVisible(false);
    const roBg = this.add.rectangle(0,0,W,H,0x000000,0.6).setOrigin(0,0);
    this.resultText = this.add.text(W/2,H/2-60,'',{fontSize:'24px',color:'#ffe066',fontFamily:FONT}).setOrigin(0.5,0);
    this.resultSub = this.add.text(W/2,H/2-20,'',{fontSize:'16px',color:'#fff',fontFamily:FONT}).setOrigin(0.5,0);
    this.resultOverlay.add([roBg,this.resultText,this.resultSub]);

    // buttons
    this.btnRetry = this.makeBtn(W/2, H/2+40, '读取存档重试', ()=>this.doRetry());
    this.btnNext = this.makeBtn(W/2, H/2+40, '进入下一关', ()=>this.doNext());
    this.btnBack = this.makeBtn(W/2, H/2+100, '返回主菜单', ()=>this.scene.start('IntroScene'));
    this.resultOverlay.add([this.btnRetry,this.btnNext,this.btnBack,this.btnRetry._label,this.btnNext._label,this.btnBack._label]);

    this.input.on('pointerdown', (p)=>this.onPointerDown(p.x,p.y));
    this.input.keyboard.on('keydown-R', ()=>{ newMatch(); this.refresh(); this.resultOverlay.setVisible(false); });
    this.input.keyboard.on('keydown-ESC', ()=>{ this.scene.start('IntroScene'); });

    newMatch();
    this.refresh();
  }

  makeBtn(x,y,label,cb){
    const btn = this.add.rectangle(x,y,220,50,0x1a2b62).setOrigin(0.5,0.5).setInteractive({useHandCursor:true}).setVisible(false);
    const t = this.add.text(x,y,label,{fontSize:'18px',color:'#fff',fontFamily:FONT}).setOrigin(0.5,0.5).setVisible(false);
    btn.on('pointerover',()=>btn.setFillStyle(0x2a449d));
    btn.on('pointerout',()=>btn.setFillStyle(0x1a2b62));
    btn.on('pointerdown',cb);
    // group into container-like by returning both? We'll manage separately
    btn._label = t;
    return btn;
  }

  showBtn(btn, visible){
    btn.setVisible(visible);
    if(btn._label) btn._label.setVisible(visible);
  }

  doRetry(){
    const s = loadGame();
    if(s) G = s;
    newMatch();
    this.refresh();
    this.resultOverlay.setVisible(false);
  }
  doNext(){
    if(!result || !result.startsWith('你赢了')) return;
    if(G.small < 2){
      // already upgraded in onPointer/aiMove? upgrade once: guard
    }
    // advance already done on win; just new match
    newMatch();
    this.refresh();
    this.resultOverlay.setVisible(false);
  }

  update(time, delta){
    for(let i=0;i<9;i++){
      const c = board[i];
      if(c && c.flash>0){
        c.flash = Math.max(0, c.flash - delta/1000);
        const ov = this.overlayRefs[i];
        if(ov) ov.setAlpha(c.flash/0.6*0.8);
      }
    }
    if(turn==='ai'){
      aiTimer -= delta/1000;
      if(aiTimer<=0){
        aiMove();
        if(result && result.startsWith('你赢了')){ advanceOnWin(); }
        if(turn==='ai'){ turn='player'; aiTimer=0; }
        this.refresh();
      }
    }
    if(currentCfg){
      this.titleText.setText('吞食九州  |  ' + currentCfg.sub);
    }
    if(turn==='player') this.hint.setText('轮到你了：先点手牌，再点棋盘');
    else if(turn==='ai') this.hint.setText('AI 思考中...');
    else this.hint.setText('');
    this.scoreAi.setText('AI  ' + score('ai'));
    this.scoreP.setText('你  ' + score('player'));

    if(result){
      this.resultOverlay.setVisible(true);
      this.resultText.setText(result);
      const win = result.startsWith('你赢了');
      const lose = result.startsWith('你输了');
      if(win){
        this.resultSub.setText('主角升级！进入下一关');
        this.showBtn(this.btnRetry, false);
        this.showBtn(this.btnNext, true);
        this.showBtn(this.btnBack, true);
      } else if(lose){
        this.resultSub.setText('战败！读取存档重试');
        this.showBtn(this.btnRetry, true);
        this.showBtn(this.btnNext, false);
        this.showBtn(this.btnBack, true);
      } else {
        this.resultSub.setText('平局');
        this.showBtn(this.btnRetry, true);
        this.showBtn(this.btnNext, false);
        this.showBtn(this.btnBack, true);
      }
    } else {
      this.resultOverlay.setVisible(false);
      this.showBtn(this.btnRetry, false);
      this.showBtn(this.btnNext, false);
      this.showBtn(this.btnBack, false);
    }
  }

  onPointerDown(mx,my){
    if(turn!=='player') return;
    const n = handP.length;
    if(n>0){
      const step = HAND_W+6;
      const x0 = W/2 - (n*step-6)/2;
      const hy = H - HAND_H - 35;
      if(my>=hy && my<=hy+HAND_H){
        for(let i=0;i<n;i++){
          const x = x0 + i*step;
          if(mx>=x && mx<=x+HAND_W){ selected = (selected===i)? null : i; this.refresh(); return; }
        }
      }
    }
    if(selected!==null){
      const ci = cellAt(mx,my);
      if(ci!==null && !board[ci]){
        const ok = placeCard('player', selected, ci);
        if(result && result.startsWith('你赢了')){ advanceOnWin(); }
        if(ok){ turn='ai'; aiTimer=0.8; }
        this.refresh();
      }
    }
  }

  refresh(){
    this.selCellHl.forEach(c=>c.destroy()); this.selCellHl=[];
    for(let i=0;i<9;i++){
      if(this.boardCards[i]){ this.boardCards[i].destroy(); this.boardCards[i]=null; }
      this.overlayRefs[i]=null;
    }
    for(let i=0;i<9;i++){
      const c = board[i];
      if(c){
        const r = cellRect(i);
        const cont = makeCard(this, c.card, c.owner, r.x, r.y, CELL_W, CELL_H);
        const ov = this.add.rectangle(r.x,r.y,CELL_W,CELL_H,0xffffff).setOrigin(0,0).setAlpha(c.flash/0.6*0.8);
        cont.add(ov);
        this.overlayRefs[i]=ov;
        this.boardCards[i]=cont;
      }
    }
    if(selected!==null){
      for(let i=0;i<9;i++){
        if(!board[i]){
          const r = cellRect(i);
          const hl = this.add.rectangle(r.x+2, r.y+2, r.w-4, r.h-4, 0xffff33, 0.12).setStrokeStyle(2, 0xffff33, 0.6).setOrigin(0,0);
          this.selCellHl.push(hl);
        }
      }
    }
    this.playerHandC.forEach(c=>c.destroy());
    this.playerHandC=[];
    const pn = handP.length;
    if(pn>0){
      const step = HAND_W+6;
      const x0 = W/2 - (pn*step-6)/2;
      const hy = H - HAND_H - 35;
      for(let i=0;i<pn;i++){
        const x = x0 + i*step;
        const cont = makeCard(this, handP[i], 'player', x, hy, HAND_W, HAND_H);
        if(selected===i){
          const hl = this.add.rectangle(-4, -4, HAND_W+8, HAND_H+8, 0xffff33, 0.25).setStrokeStyle(3, 0xffff33).setOrigin(0,0);
          cont.add(hl);
        }
        this.playerHandC.push(cont);
      }
    }
    this.aiHandC.forEach(c=>c.destroy());
    this.aiHandC=[];
    const an = handA.length;
    if(an>0){
      const step = HAND_W+6;
      const x0 = W/2 - (an*step-6)/2;
      const ay = 30;
      for(let i=0;i<an;i++){
        const x = x0 + i*step;
        const cont = makeCard(this, handA[i], 'ai', x, ay, HAND_W, HAND_H);
        this.aiHandC.push(cont);
      }
    }
  }
}

function makeCard(scene, card, owner, x, y, w, h){
  const cont = scene.add.container(x,y);
  const ownerColor = owner==='ai' ? 0x5a1616 : 0x1a2b62;
  const body = scene.add.rectangle(0,0,w,h,0x060608).setOrigin(0,0);
  const inner = scene.add.rectangle(3,3,w-6,h-6,ownerColor).setOrigin(0,0);
  const panel = scene.add.rectangle(8, Math.floor(h*0.24), w-16, Math.floor(h*0.55), 0x101014).setOrigin(0,0);
  const name = scene.add.text(8,5, card.name, {fontSize:'14px',color:'#fff',fontFamily:FONT}).setOrigin(0,0);
  const nw = 22;
  const topT = scene.add.text(Math.floor((w-nw)/2), Math.floor(h*0.26), numText(card.top), {fontSize:'20px',color:'#fff399',fontFamily:FONT}).setOrigin(0,0);
  const leftT = scene.add.text(10, Math.floor(h*0.46), numText(card.left), {fontSize:'20px',color:'#fff399',fontFamily:FONT}).setOrigin(0,0);
  const rightT = scene.add.text(w-26, Math.floor(h*0.46), numText(card.right), {fontSize:'20px',color:'#fff399',fontFamily:FONT}).setOrigin(0,0);
  const bottomT = scene.add.text(Math.floor((w-nw)/2), h-30, numText(card.bottom), {fontSize:'20px',color:'#fff399',fontFamily:FONT}).setOrigin(0,0);
  const lvl = scene.add.text(6, h-22, 'Lv'+card.level, {fontSize:'12px',color:'#b0bcb0',fontFamily:FONT}).setOrigin(0,0);
  cont.add([body,inner,panel,name,topT,leftT,rightT,bottomT,lvl]);
  return cont;
}

const config = {
  type: Phaser.AUTO,
  width: W, height: H,
  parent: 'game',
  scene: [IntroScene, GameScene]
};
new Phaser.Game(config);
