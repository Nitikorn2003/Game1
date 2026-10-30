import { isInk, type Ink } from './palette.js';
import type { Shape } from './nonogram.js';

/** A picture for one field, drawn row by row: '.' is plain green rice, a letter one of the inks. */
export interface Picture {
  id: string;
  rows: readonly string[];
  /** The colour of the plain cells once the picture has grown: water, sky or night. Plain rice when not given. */
  ground?: Ink;
}

export interface Album {
  id: string;
  pictures: readonly Picture[];
}

export const ALBUMS = [
  {
    id: 'first',
    pictures: [
      { id: 'heart', rows: ['.r.r.', 'rrrrr', 'rrrrr', '.rrr.', '..r..'] },
      { id: 'house', rows: ['..r..', '.rrr.', 'rrrrr', '.www.', '.wnw.'] },
      { id: 'tree', rows: ['.ggg.', 'ggggg', 'ggggg', '..n..', '..n..'] },
      { id: 'sun', rows: ['y.y.y', '.yyy.', 'yyyyy', '.yyy.', 'y.y.y'] },
      { id: 'mushroom', rows: ['..rrr..', '.rwrrr.', 'rrrrwrr', 'rwrrrrr', '..www..', '..www..', '..www..'] },
      { id: 'fish', rows: ['..bbb.b', '.bbbbbb', 'bkbbbb.', '.bbbbbb', '..bbb.b'], ground: 'c' },
      { id: 'mug', rows: ['ooooo..', 'ooooooo', 'ooooo.o', 'ooooooo', '.ooo...'] },
      { id: 'umbrella', rows: ['..rrr..', '.rrrrr.', 'rrrrrrr', '...n...', '...n...', '.n.n...', '..n....'] },
      { id: 'cat', rows: ['o......o', 'oo....oo', 'oooooooo', 'oo.oo.oo', 'oooooooo', 'oooiiooo', '.oooooo.'] },
      { id: 'apple', rows: ['.....g..', '....ng..', '.rrrnrr.', 'rrrrrrrr', 'rrrrrrrr', 'rrrrrrrr', '.rrrrrr.', '..rr.rr.'] },
      { id: 'star', rows: ['...yy...', '...yy...', 'yyyyyyyy', '.yyyyyy.', '..yyyy..', '.yyyyyy.', '.yy..yy.', 'yy....yy'] },
      { id: 'leaf', rows: ['.....ggg', '...ggggg', '..gggglg', '.gggglgg', '.ggglggg', '.gglgggg', '.glggg..', 'l.......'] },
    ],
  },
  {
    id: 'water',
    pictures: [
      { id: 'frog', rows: ['.gg..gg.', 'gkkggkkg', 'gggggggg', 'gggggggg', 'g.gggg.g', 'gg....gg', '.gggggg.'] },
      { id: 'duck', rows: ['..yyy...', '.ykyy...', 'ooyyy...', '..yyy..y', '.yyyyyyy', 'yyyyyyyy', '.yyyyyy.', 'b.bbbb.b'], ground: 'c' },
      { id: 'snail', rows: ['k..k....', '.kk..nn.', '.ll.nttn', '.ll.ntnn', '.ll..nn.', 'llllllll'] },
      { id: 'sailboat', rows: ['...nw...', '...nww..', '...nwww.', '..wnwwww', '.wwnwwww', '...n....', 'nnnnnnnn', '.nnnnnn.'], ground: 'c' },
      { id: 'crab', rows: ['r.r....r.r', 'rr......rr', '.r.k..k.r.', '..rrrrrr..', '.rrrrrrrr.', 'r.rrrrrr.r', '.r.r..r.r.'] },
      { id: 'turtle', rows: ['....tt....', '...tttt...', 't.gggggg.t', 'ttglgglgtt', '..gggggg..', '..glgglg..', 't.gggggg.t', 'tt.gggg.tt', '....t.....'] },
      { id: 'dragonfly', rows: ['....kk....', '....bb....', 'ccccbbcccc', '.cccbbccc.', '....bb....', '.cccbbccc.', '..ccbbcc..', '....bb....', '....bb....', '....b.....'] },
      { id: 'heron', rows: ['...ww.....', 'nnwkw.....', '...ww.....', '....w.....', '....ww....', '.....www..', '....wwwwss', '.....wwss.', '......n...', '......n...'] },
      { id: 'anchor', rows: ['...kkk...', '...k.k...', '...kkk...', '....k....', '.kkkkkkk.', '....k....', 'k...k...k', 'kk..k..kk', '.kkkkkkk.'], ground: 'c' },
      { id: 'koi', rows: ['....ooo....', '..owwoooo.o', '.wwkwoooooo', 'owwwwoowooo', '.wwwoowwoo.', '..ooooooo.o', '....oo.....'], ground: 'b' },
      { id: 'waterwheel', rows: ['....nn....', '..nnnnnn..', '.n..nn..n.', '.n..nn..n.', 'nnnnnnnnnn', 'nnnnnnnnnn', '.n..nn..n.', '.n..nn..n.', '..nnnnnn..', '....nn....', 'bbbbbbbbbb'] },
      { id: 'wateringcan', rows: ['..ssss....', '.s....s...', '.ssssss..s', 'sssssss.s.', 'ssssssss..', 'sssssss...', 'sssssss...', '.sssss....'] },
    ],
  },
  {
    id: 'farm',
    pictures: [
      { id: 'buffalo', rows: ['t........t', 'tt......tt', '.tt....tt.', '..tkkkkt..', '.kkkkkkkk.', 'kk.kkkk.kk', '..kkkkkk..', '..kkkkkk..', '..ksskss..', '...ssss...'] },
      { id: 'rooster', rows: ['..rr......', '.roo....gg', 'yoko...ggk', '.rooo..gkk', '..oooo.gk.', '..oooooog.', '...oooooo.', '....oooo..', '....y..y..', '...yy.yy..'] },
      { id: 'chick', rows: ['...yyy...', '..yyyyy..', '..ykyyyo.', '..yyyyoo.', '.yyyyyy..', 'yyyyyyyy.', 'yyyyyyyy.', '.yyyyyy..', '..o..o...'] },
      { id: 'pig', rows: ['ii.......ii', 'iii.....iii', '.iiiiiiiii.', 'iiiiiiiiiii', 'ii.iiiii.ii', 'iiiiiiiiiii', 'iiirrrrriii', 'iiir.r.riii', '.iirrrrrii.', '..iiiiiii..'] },
      { id: 'goat', rows: ['.nn....nn.', '..nn..nn..', 'ww.wwww.ww', '.wwwwwwww.', '..wkwwkw..', '..wwwwww..', '...wwww...', '...wiiw...', '....ss....', '....s.....'] },
      { id: 'rabbit', rows: ['.ww..ww.', '.wi..iw.', '.wi..iw.', '.ww..ww.', 'wwwwwwww', 'wkwwwwkw', 'wwwiiwww', 'wwwwwwww', '.wwwwww.'] },
      { id: 'dog', rows: ['..tttttt..', 'nnttttttnn', 'nntkttktnn', 'nnttttttnn', 'nn.tttt.nn', 'n..tkkt..n', '...tttt...', '....ii....'] },
      { id: 'sheep', rows: ['..w.w.w...', '.wwwwwww..', 'wwwwwwwkk.', 'wwwwwwwkwk', 'wwwwwwwkk.', '.wwwwwww..', '.k.k.k.k..', '.k.k.k.k..'] },
      { id: 'mouse', rows: ['sss....sss', 'siis..siis', 'siissssiis', '.ssssssss.', '.skssssks.', '..ssssss..', '...siis...', '....ss....'] },
      { id: 'horse', rows: ['.....n.n..', '....nnnnk.', '...nnnnnkk', '..nnknnnkk', '.nnnnnnnkk', 'nnnnnnnnkk', 'nnn..nnnnk', 'nn...nnnnk', '.....nnnnn', '.....nnnnn'] },
      { id: 'goose', rows: ['..ww......', 'ooww......', '..ww......', '..ww......', '..ww......', '..www.....', '.wwwwww..w', 'wwwwwwwwww', '.wwwsswww.', '..wwwww...', '...o..o...', '..oo.oo...'] },
      { id: 'cow', rows: ['.ww........', 'wwkw.......', 'wwwwkkwwkw.', 'iwwkkkwwwkk', 'iwwwkwwwkkw', '.wwwwwwwwww', '..w.w...w.w', '..w.w...w.w'] },
    ],
  },
  {
    id: 'village',
    pictures: [
      { id: 'teapot', rows: ['.....nn.....', '....bbbb....', '...wwwwww...', 'w..wwwwwwbb.', '.w.bbbbbb..b', '..wwwwwwww.b', '...wwwwwwbb.', '...wwwwww...', '....bbbb....'] },
      { id: 'ricebowl', rows: ['.s..s..s..', '..s..s..s.', '...wwww...', '.wwwwwwww.', 'rrrrrrrrrr', '.rrrrrrrr.', '..rrrrrr..', '...rrrr...', '..rrrrrr..'] },
      { id: 'hat', rows: ['.....tt.....', '....tttt....', '...tttttt...', '..tttttttt..', '.rrrrrrrrrr.', 'tttttttttttt', '..n......n..', '...n....n...', '....nnnn....'] },
      { id: 'kite', rows: ['....r.....', '...rry....', '..rrryy...', '.rrrryyy..', 'bbbbbgggg.', '.bbbbggg..', '..bbbgg...', '...bbg....', '....n.....', '...i.n.i..', '....i.i...', '......n...'] },
      { id: 'lantern', rows: ['...nn...', '..yyyy..', '.rrrrrr.', 'rrrrrrrr', 'rryrryrr', 'rrrrrrrr', '.rrrrrr.', '..yyyy..', '...yy...', '..y..y..'] },
      { id: 'bell', rows: ['....n....', '...yyy...', '..yyyyy..', '..yyyyy..', '.yyyyyyy.', '.yyyyyyy.', 'yyyyyyyyy', 'yyyyyyyyy', '....n....'] },
      { id: 'basket', rows: ['..nnnnnn..', '.n......n.', '.n......n.', 'tttttttttt', 'tntntntntn', '.tttttttt.', '.ntntntnt.', '..tttttt..'] },
      { id: 'stilthouse', rows: ['.....rr.....', '....rrrr....', '...rrrrrr...', '..rrrrrrrr..', '.rrrrrrrrrr.', 'rrrrrrrrrrrr', '.nnnnnnnnnn.', '.nn.nnnn.nn.', '.nnnnnnnnnn.', 'nnnnnnnnnnnn', '.n..n..n..n.', '.n..n..n..n.'], ground: 'c' },
      { id: 'scarecrow', rows: ['....tttt....', '...tttttt...', '.tttttttttt.', '....wkwk....', '....wwww....', 'nnnnbbbbnnnn', 'y.nnbbbbnn.y', '....bbbb....', '....bbbb....', '.....nn.....', '.....nn.....', '.....nn.....'] },
      { id: 'drum', rows: ['n........n', '.n......n.', '..tttttt..', '.tttttttt.', 'rrrrrrrrrr', 'yrrryyrrry', 'ryryrryryr', 'rryrrrryrr', 'rrrrrrrrrr', '.tttttttt.'] },
      { id: 'jar', rows: ['...nnnn...', '..nnnnnn..', '...nnnn...', '.nnnnnnnn.', 'nnnnnnnnnn', 'nynynynyny', 'ynynynynyn', 'nnnnnnnnnn', '.nnnnnnnn.', '..nnnnnn..', '...nnnn...'] },
      { id: 'cookpot', rows: ['.....kk.....', '...kkkkkk...', 'kk.kkkkkk.kk', '.kkkkkkkkkk.', '..kkkkkkkk..', '..kkkkkkkk..', '...kkkkkk...', '...r.oo.r...', '..royyyyor..', '.nnnnnnnnnn.'] },
    ],
  },
  {
    id: 'harvest',
    pictures: [
      { id: 'sheaf', rows: ['y...yy...y', 'yy..yy..yy', '.yy.yy.yy.', '..yyyyyy..', '...yyyy...', '...nnnn...', '...yyyy...', '...yyyy...', '..yyyyyy..', '.yy.yy.yy.', 'yy..yy..yy', 'y...yy...y'] },
      { id: 'corn', rows: ['...yy...', '..yoyy..', '..yyoy..', '.gyoyyg.', '.gyyoyg.', 'ggyoyygg', 'ggyyoygg', 'gggyoggg', '.gggggg.', '..gggg..', '...gg...', '...gg...'] },
      { id: 'pumpkin', rows: ['......g.....', '.....nn.....', '..ooorooro..', '.oooroorooo.', 'ooorooroooro', 'ooorooroooro', 'ooorooroooro', '.oooroorooo.', '..ooorooro..', '....oooo....'] },
      { id: 'carrot', rows: ['......g.g.', '.....g.gg.', '......ggg.', '.....ooo..', '....oooo..', '...oooo...', '...ooo....', '..ooo.....', '..oo......', '.oo.......', '.o........'] },
      { id: 'mango', rows: ['.......n....', '......nggg..', '...oooo.ggg.', '..oooooo....', '.oooyyyoo...', 'oooyyyyyoo..', 'ooyyyyyyyo..', 'ooyyyyyyyo..', '.oyyyyyyo...', '..oyyyyo....', '...oooo.....'] },
      { id: 'bananas', rows: ['.........nn.', '........yyn.', '.......yyy..', '......yyyy..', 'y...yyyyy...', 'yy.yyyyyy...', '.yyyyyyy....', '..yyyyy.....', '...yyy......'] },
      { id: 'pineapple', rows: ['...g..g...', '....gg....', '..g.gg.g..', '...gggg...', '..yyyyyy..', '.yoyyoyyo.', '.yyoyyoyy.', '.oyyoyyoy.', '.yoyyoyyo.', '.yyoyyoyy.', '..yyyyyy..', '...yyyy...'] },
      { id: 'watermelon', rows: ['rrrrrrrrrrrr', 'rrkrrrrrkrrr', 'wrrrrkrrrrrw', '.wrrkrrrkrw.', '.gwrrrrrrwg.', '..gwwwwwwg..', '...gggggg...'] },
      { id: 'chili', rows: ['.g..........', '.gg.........', 'rrrrr.......', 'rrrrrrr.....', '.rrrrrrrr...', '...rrrrrrr..', '.....rrrrrr.', '........rrrr'] },
      { id: 'eggplant', rows: ['.....n....', '....ggg...', '...ggggg..', '...ppppg..', '..pppppp..', '.ppppppp..', 'pppppppp..', 'ppppppppp.', 'ppppppppp.', '.pppppppp.', '..pppppp..', '...pppp...'] },
      { id: 'grapes', rows: ['....n.gg..', '....nggg..', '.pp.pp.pp.', '.pp.pp.pp.', '..pp.pp.p.', '..pp.pp...', '...pp.pp..', '...pp.pp..', '....pp....', '....pp....'] },
      { id: 'strawberry', rows: ['...g..g...', '..gggggg..', '.rrggggrr.', 'rrrrrrrrrr', 'ryrrryrrry', 'rrrryrrrrr', '.ryrrrryr.', '.rrrryrrr.', '..ryrrrr..', '...rrryr..', '....rr....'] },
    ],
  },
  {
    id: 'sky',
    pictures: [
      { id: 'rainbow', rows: ['...rrrrrr...', '..rroooorr..', '.rrooyyoorr.', '.rooyyyyoor.', 'rooyy..yyoor', 'roy......yor', 'wwy......yww'], ground: 'c' },
      { id: 'raincloud', rows: ['....sss.....', '..ssssss....', '.sssssssss..', 'ssssssssssss', 'ssssssssssss', '.ssssssssss.', '............', '.b..b..b..b.', '.b..b..b..b.'], ground: 'c' },
      { id: 'moon', rows: ['....yyyy....', '..yyyy......', '.yyy......w.', '.yy.........', 'yyy...w.....', 'yyy.........', 'yyy.........', 'yyy.....w...', '.yyy........', '.yyyy......y', '..yyyyy.....', '....yyyyy...'], ground: 'k' },
      { id: 'butterfly', rows: ['...k....k...', '....k..k....', '.ppp.kk.ppp.', 'pppppkkppppp', 'ppippkkppipp', 'pppppkkppppp', '.pppkkkkppp.', '..ii.kk.ii..', '.iii.kk.iii.', '..ii....ii..'] },
      { id: 'bee', rows: ['....ww.ww...', '...wwwwwww..', '....ww.ww...', '..ykykyky...', '.yykykykyk..', '.yykykykykk.', '..ykykyky...', '...k...k....'] },
      { id: 'swallow', rows: ['kk........kk', '.kkk....kkk.', '..kkkkkkkk..', '...kkwwkk...', '....kwwk....', '....kkkk....', '...kk..kk...'], ground: 'c' },
      { id: 'owl', rows: ['n........n', 'nn......nn', 'nnnnnnnnnn', 'nwwnnnnwwn', 'wwkwnnwkww', 'nwwnoonwwn', 'nnnnoonnnn', 'nnttttttnn', 'nntntnttnn', 'nnttttttnn', '.nnnnnnnn.', '..o.oo.o..'] },
      { id: 'sunflower', rows: ['...y.yy.y...', '..yyyyyyyy..', '.yyynnnnyyy.', 'yyynnnnnnyyy', '.yynnnnnnyy.', 'yyynnnnnnyyy', '.yyynnnnyyy.', '..yyyyyyyy..', '...y.gg.y...', '..gg.gg.....', '...gggg.....', '.....gg.....'] },
      { id: 'mountain', rows: ['.........yy.', '....w...yyyy', '...www...yy.', '..wwsss.....', '..ssssss.w..', '.ssssssswww.', '.sssssssssss', 'ssssssssssss', 'gggggggggggg'], ground: 'c' },
      { id: 'snowman', rows: ['...kkkk...', '...kkkk...', '..kkkkkk..', '...wwww...', '..wkwwkw..', '..wwoowww.', '...wwww...', '..rrrrrr..', '.wwwwwwww.', 'wwwwkwwwww', 'wwwwwwwwww', '.wwwkwwww.'], ground: 'c' },
      { id: 'mapleleaf', rows: ['.....r.....', '....rrr....', '.r..rrr..r.', '.rr.rrr.rr.', '.rrrrrrrrr.', 'rrrrrrrrrrr', '.rrrrrrrrr.', '..rrrrrrr..', '.rrrrrrrrr.', '.....n.....', '.....n.....'] },
      { id: 'balloon', rows: ['...ryyr...', '..bryyrb..', '.bbryyrbb.', 'bbbryyrbbb', 'bbbryyrbbb', '.bbryyrbb.', '..bryyrb..', '...ryyr...', '....nn....', '...nnnn...', '...nnnn...'], ground: 'c' },
    ],
  },
] as const satisfies readonly Album[];

export type AlbumId = (typeof ALBUMS)[number]['id'];

/** The shape a picture's field must take: its letters are planted, its dots are not. */
export function shapeOf(picture: Picture): Shape {
  const width = picture.rows[0]?.length ?? 0;
  return { width, height: picture.rows.length, filled: picture.rows.join('').split('').map((c) => c !== '.') };
}

/** Whether every row is as long as the first and uses only the inks. */
export function wellDrawn(picture: Picture): boolean {
  const width = picture.rows[0]?.length ?? 0;
  return width > 0 && picture.rows.every((row) => row.length === width && row.split('').every((c) => c === '.' || isInk(c)));
}
