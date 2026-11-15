import {test} from 'node:test';
import assert from 'node:assert/strict';
import {displayMusicTitle} from '../src/music-title.mjs';
test('hide soundtrack notes without changing the underlying title',()=>{
 const title='时间都去哪儿了（电影《私人定制》插曲\\电视剧《老牛家的战争》主题曲\\电视剧《空巢姥爷》主题曲）';
 assert.equal(displayMusicTitle(title),'时间都去哪儿了');
 assert.equal(displayMusicTitle('歌名 (电影《片名》插曲) (Live)'),'歌名 (Live)');
 assert.equal(displayMusicTitle('Song (Original Motion Picture Soundtrack)'),'Song');
});
test('keep version names and meaningful parenthetical titles',()=>{
 for(const title of ['告白气球 (Cover 周杰伦)','歌名（Live 现场版）','歌名 (Remix)','歌名（电影原声 Live）','逃跑计划（电影）','（电影《片名》主题曲）'])assert.equal(displayMusicTitle(title),title);
});
