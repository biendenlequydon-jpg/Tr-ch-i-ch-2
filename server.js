const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');
const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;
const questions = JSON.parse(fs.readFileSync(path.join(__dirname, 'questions.json'), 'utf8'));
app.use(express.static(path.join(__dirname, 'public')));
app.get('/health', (_, res) => res.json({ok:true, questions:questions.length}));
const rooms = new Map();
function pin() { let s; do { s = String(Math.floor(100000 + Math.random()*900000)); } while (rooms.has(s)); return s; }
function safePlayer(p) { return {id:p.id, name:p.name, score:p.score, correct:p.correct, answered:p.answered, totalTime:p.totalTime, finished:p.finished}; }
function leaderboard(room) {
  return [...room.players.values()].map(safePlayer).sort((a,b)=>b.score-a.score || b.correct-a.correct || a.totalTime-b.totalTime);
}
function publicRoom(room) {
  return {pin:room.pin, status:room.status, questionIndex:room.questionIndex, total:questions.length, players:leaderboard(room), question:room.questionIndex>=0 ? {...questions[room.questionIndex], a:undefined, why:undefined} : null};
}
function emitRoom(room) { io.to(room.pin).emit('room:update', publicRoom(room)); }
io.on('connection', socket => {
  socket.on('host:create', (_, cb) => {
    const code = pin(), token = require('crypto').randomBytes(18).toString('hex');
    const room = {pin:code, token, hostSocket:socket.id, status:'lobby', questionIndex:-1, checkpoint:false, players:new Map(), answers:new Map(), startedAt:0};
    rooms.set(code, room); socket.join(code); socket.data.hostPin=code;
    cb({ok:true,pin:code,token,questionCount:questions.length}); emitRoom(room);
  });
  socket.on('host:resume', ({pin:code,token}, cb) => {
    const room=rooms.get(String(code||''));
    if (!room || room.token!==token) return cb({ok:false,error:'Không xác thực được quyền giáo viên.'});
    room.hostSocket=socket.id; socket.join(room.pin); socket.data.hostPin=room.pin; cb({ok:true,room:publicRoom(room)}); emitRoom(room);
  });
  socket.on('player:join', ({pin:code,name}, cb) => {
    const room=rooms.get(String(code||'').trim());
    if (!room) return cb({ok:false,error:'Không tìm thấy phòng. Hãy kiểm tra mã PIN.'});
    if (room.status!=='lobby') return cb({ok:false,error:'Phòng đã bắt đầu, không thể tham gia lúc này.'});
    const clean=String(name||'').trim().slice(0,24);
    if (!clean) return cb({ok:false,error:'Vui lòng nhập tên hoặc biệt danh.'});
    const id=socket.id;
    room.players.set(id,{id,name:clean,score:0,correct:0,answered:0,totalTime:0,finished:false,answers:[]});
    socket.join(room.pin); socket.data.playerPin=room.pin;
    cb({ok:true,playerId:id,pin:room.pin}); emitRoom(room);
  });
  socket.on('host:start', ({pin:code,token}, cb) => {
    const room=rooms.get(String(code||'')); if (!room || room.token!==token || room.hostSocket!==socket.id) return cb({ok:false,error:'Không có quyền bắt đầu phòng này.'});
    if (!room.players.size) return cb({ok:false,error:'Cần ít nhất một học sinh tham gia.'});
    room.status='playing'; room.questionIndex=0; room.answers.clear(); room.startedAt=Date.now(); emitRoom(room); cb({ok:true});
  });
  socket.on('host:next', ({pin:code,token}, cb) => {
    const room=rooms.get(String(code||'')); if (!room || room.token!==token || room.hostSocket!==socket.id) return cb({ok:false,error:'Không có quyền điều khiển phòng này.'});
    if (room.checkpoint) {
      room.checkpoint=false; room.questionIndex++; room.answers.clear(); room.startedAt=Date.now(); emitRoom(room); return cb({ok:true});
    }
    if (room.questionIndex >= questions.length-1) {
      room.status='finished'; for (const p of room.players.values()) p.finished=true;
      emitRoom(room); io.to(room.pin).emit('game:finished',{leaderboard:leaderboard(room),stats:stats(room)}); return cb({ok:true,finished:true});
    }
    if ([9,19,29].includes(room.questionIndex)) {
      room.checkpoint=true; io.to(room.pin).emit('game:checkpoint',{completed:room.questionIndex+1,leaderboard:leaderboard(room)}); return cb({ok:true,checkpoint:true});
    }
    room.questionIndex++; room.answers.clear(); room.startedAt=Date.now(); emitRoom(room); cb({ok:true});
  });
  socket.on('player:answer', ({pin:code,answer,elapsedMs}, cb) => {
    const room=rooms.get(String(code||'')), p=room && room.players.get(socket.id);
    if (!room || room.status!=='playing' || !p) return cb({ok:false,error:'Không thể gửi câu trả lời lúc này.'});
    if (room.answers.has(socket.id)) return cb({ok:false,error:'Bạn đã trả lời câu này rồi.'});
    const q=questions[room.questionIndex], idx=Number(answer), elapsed=Math.max(0,Number(elapsedMs)||0);
    if (elapsed > q.time*1000) return cb({ok:false,error:'Đã hết thời gian trả lời câu này.'});
    if (!Number.isInteger(idx) || idx<0 || idx>3) return cb({ok:false,error:'Đáp án không hợp lệ.'});
    const correct=idx===q.a, remaining=Math.max(0,q.time*1000-elapsed);
    const earned=correct ? Math.round(q.points*(0.7+0.3*remaining/(q.time*1000))) : 0;
    p.score+=earned; p.correct+=correct?1:0; p.answered++; p.totalTime+=elapsed;
    p.answers.push({questionId:q.id,choice:idx,correct,earned,elapsedMs:elapsed});
    room.answers.set(socket.id,{correct,earned});
    cb({ok:true,correct,earned,score:p.score,why:q.why,correctIndex:q.a});
    emitRoom(room);
    if (room.answers.size===room.players.size) io.to(room.pin).emit('round:allAnswered');
  });
  socket.on('host:reveal', ({pin:code,token}, cb) => {
    const room=rooms.get(String(code||'')); if (!room || room.token!==token || room.hostSocket!==socket.id) return cb({ok:false,error:'Không có quyền xem đáp án.'});
    const q=questions[room.questionIndex]; io.to(room.pin).emit('question:reveal',{correctIndex:q.a,why:q.why}); cb({ok:true});
  });
  socket.on('host:export', ({pin:code,token}, cb) => {
    const room=rooms.get(String(code||'')); if (!room || room.token!==token || room.hostSocket!==socket.id) return cb({ok:false,error:'Không có quyền xuất kết quả.'});
    cb({ok:true,rows:leaderboard(room),stats:stats(room)});
  });
  socket.on('disconnect', () => {
    const code=socket.data.playerPin, room=code && rooms.get(code);
    if (room && room.players.has(socket.id)) { room.players.get(socket.id).connected=false; emitRoom(room); }
  });
});
function stats(room) {
  const ps=[...room.players.values()];
  return {players:ps.length, avgScore:ps.length?Math.round(ps.reduce((s,p)=>s+p.score,0)/ps.length):0,
    questionStats:questions.map(q=>{let n=0,c=0; for(const p of ps){const a=p.answers.find(x=>x.questionId===q.id);if(a){n++;if(a.correct)c++;}} return {id:q.id,topic:q.topic,question:q.q,answered:n,correct:c,wrong:n-c,accuracy:n?Math.round(c/n*100):0};})};
}
server.listen(PORT,()=>console.log(`Quiz server listening on ${PORT}`));
