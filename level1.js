window.LEVEL_PACKS = window.LEVEL_PACKS || {};
window.LEVEL_PACKS[1] = {
  big: 1,
  title: '第一大关：讨伐袁术',
  story: '袁术在寿春称帝后，曹操挟天子以令诸侯，下达讨伐袁术的诏书。\n\n当时刘备刚被吕布夺了徐州主位，暂居小沛，曹操便命刘备作为先锋出兵讨伐袁术。',
  smalls: [
    { sub: '第一小关：徐州南面山寨', enemies: ['纪灵','张勋','陈纪','雷薄','陈兰'] },
    { sub: '第二小关：南面山洞旁营寨', enemies: ['纪灵','雷薄','陈兰','韩暹', (Math.random()<0.5?'张勋':'陈纪')] }
  ]
};
