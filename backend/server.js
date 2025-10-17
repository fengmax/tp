const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3001;

// 中间件
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// 数据文件路径
const PLAYERS_FILE = path.join(__dirname, 'data/players.json');
const VOTES_FILE = path.join(__dirname, 'data/votes.json');

// 确保数据目录存在
if (!fs.existsSync(path.dirname(PLAYERS_FILE))) {
    fs.mkdirSync(path.dirname(PLAYERS_FILE), { recursive: true });
}

// 初始化数据文件
function initializeDataFiles() {
    if (!fs.existsSync(PLAYERS_FILE)) {
        fs.writeFileSync(PLAYERS_FILE, JSON.stringify([
            { account: "player1", level: 50, password: "123456" },
            { account: "player2", level: 45, password: "123456" },
            { account: "player3", level: 40, password: "123456" },
            { account: "player4", level: 35, password: "123456" },
            { account: "player5", level: 30, password: "123456" }
        ], null, 2));
    }
    
    if (!fs.existsSync(VOTES_FILE)) {
        fs.writeFileSync(VOTES_FILE, JSON.stringify({
            activeVotes: [],
            voteResults: {},
            playerVotes: {}
        }, null, 2));
    }
}

// 读取数据
function readPlayers() {
    try {
        return JSON.parse(fs.readFileSync(PLAYERS_FILE, 'utf8'));
    } catch (error) {
        return [];
    }
}

function readVotesData() {
    try {
        return JSON.parse(fs.readFileSync(VOTES_FILE, 'utf8'));
    } catch (error) {
        return { activeVotes: [], voteResults: {}, playerVotes: {} };
    }
}

// 写入数据
function writeVotesData(data) {
    fs.writeFileSync(VOTES_FILE, JSON.stringify(data, null, 2));
}

// 路由

// 玩家登录
app.post('/api/login', (req, res) => {
    const { playerAccount } = req.body;
    
    if (!playerAccount) {
        return res.status(400).json({ success: false, message: '请输入账号' });
    }
    
    const players = readPlayers();
    const player = players.find(p => p.account === playerAccount);
    
    if (!player) {
        return res.status(401).json({ success: false, message: '账号错误' });
    }
    
    // 计算排名和权重
    const sortedPlayers = [...players].sort((a, b) => b.level - a.level);
    const playerRank = sortedPlayers.findIndex(p => p.account === playerAccount) + 1;

    // 获取前3名玩家
    const top3Players = sortedPlayers.slice(0, 3);

    // 检查前3名是否等级相同
    const top3Levels = top3Players.map(player => player.level);
    const allTop3SameLevel = top3Levels.length >= 3 && top3Levels.every(level => level === top3Levels[0]);

    // 计算权重
    let weight;
    if (allTop3SameLevel) {
        // 情况1：前3名等级相同，所有玩家权重1
        weight = 1;
    } else {
        // 情况2：前3名等级不同，前两名权重2，其他权重1
        weight = playerRank <= 2 ? 2 : 1;
    }

    res.json({
        success: true,
        player: {
            account: player.account,
            level: player.level,
            rank: playerRank,
            weight: weight
        }
    });
}); // 这里缺少了这个结束括号

// 管理员登录
app.post('/api/admin/login', (req, res) => {
    const { password } = req.body;
    
    if (password === 'admin123') {
        res.json({ success: true });
    } else {
        res.status(401).json({ success: false, message: '管理员密码错误' });
    }
});

// 获取所有玩家
app.get('/api/players', (req, res) => {
    const players = readPlayers();
    res.json(players);
});

// 添加上传玩家数据接口
app.post('/api/players/upload', (req, res) => {
    const { players } = req.body;
    
    if (!Array.isArray(players)) {
        return res.status(400).json({ success: false, message: '数据格式错误' });
    }
    
    // 验证数据格式
    const invalidPlayers = players.filter(p => !p.account);
    if (invalidPlayers.length > 0) {
        return res.status(400).json({ success: false, message: '数据包含无效的玩家账号' });
    }
    
    // 为每个玩家添加默认密码
    const playersWithPassword = players.map(p => ({
        ...p,
        password: p.password || '123456'
    }));
    
    fs.writeFileSync(PLAYERS_FILE, JSON.stringify(playersWithPassword, null, 2));
    
    res.json({ 
        success: true, 
        message: `成功上传 ${players.length} 名玩家数据`,
        count: players.length
    });
});

// 获取进行中的投票
app.get('/api/votes/active', (req, res) => {
    const data = readVotesData();
    res.json(data.activeVotes);
});

// 获取投票结果
app.get('/api/votes/results', (req, res) => {
    const data = readVotesData();
    res.json(data.voteResults);
});

// 创建新投票
app.post('/api/votes/create', (req, res) => {
    const { topic, description, type, options } = req.body;
    
    if (!topic || !options || options.length < 2) {
        return res.status(400).json({ success: false, message: '请填写完整的投票信息' });
    }
    
    const data = readVotesData();
    const newVote = {
        id: Date.now().toString(),
        topic,
        description: description || '',
        type: type || 'single',
        options: options.map(option => ({
            id: Math.random().toString(36).substr(2, 9),
            text: option,
            votes: 0
        })),
        createdAt: new Date().toISOString(),
        totalVotes: 0
    };
    
    data.activeVotes.push(newVote);
    writeVotesData(data);
    
    res.json({ success: true, vote: newVote });
});

// 提交投票
app.post('/api/votes/vote', (req, res) => {
    const { voteId, selectedOptions, playerAccount } = req.body;
    
    if (!voteId || !selectedOptions || !playerAccount) {
        return res.status(400).json({ success: false, message: '缺少必要的投票信息' });
    }
    
    const data = readVotesData();
    const vote = data.activeVotes.find(v => v.id === voteId);
    
    if (!vote) {
        return res.status(404).json({ success: false, message: '投票不存在' });
    }
    
    // 检查玩家是否已经投过票
    const voteKey = `${playerAccount}_${voteId}`;
    if (data.playerVotes[voteKey]) {
        return res.status(400).json({ success: false, message: '您已经投过票了' });
    }
    
    // 获取玩家权重
    const players = readPlayers();
    const sortedPlayers = [...players].sort((a, b) => b.level - a.level);
    const playerRank = sortedPlayers.findIndex(p => p.account === playerAccount) + 1;
    const weight = playerRank <= 2 ? 2 : 1;
    
    // 记录玩家投票
    data.playerVotes[voteKey] = {
        selectedOptions,
        weight,
        votedAt: new Date().toISOString()
    };
    
    // 更新投票计数
    selectedOptions.forEach(optionId => {
        const option = vote.options.find(opt => opt.id === optionId);
        if (option) {
            option.votes += weight;
        }
    });
    
    vote.totalVotes += weight;
    
    // 更新投票结果
    if (!data.voteResults[voteId]) {
        data.voteResults[voteId] = {
            topic: vote.topic,
            totalVotes: 0,
            options: {}
        };
    }
    
    data.voteResults[voteId].totalVotes = vote.totalVotes;
    vote.options.forEach(option => {
        data.voteResults[voteId].options[option.id] = {
            text: option.text,
            votes: option.votes,
            percentage: vote.totalVotes > 0 ? ((option.votes / vote.totalVotes) * 100).toFixed(1) : 0
        };
    });
    
    writeVotesData(data);
    
    res.json({ success: true, message: '投票成功', weight });
});

// 删除投票
app.delete('/api/votes/:voteId', (req, res) => {
    const { voteId } = req.params;
    
    console.log(`删除投票: ${voteId}`);
    
    const data = readVotesData();
    
    // 1. 删除活跃投票
    data.activeVotes = data.activeVotes.filter(v => v.id !== voteId);
    
    // 2. 删除投票结果
    if (data.voteResults[voteId]) {
        delete data.voteResults[voteId];
        console.log(`✅ 删除投票结果: ${voteId}`);
    } else {
        console.log(`❌ 未找到投票结果: ${voteId}`);
        // 检查是否有类型不匹配的情况
        const foundKey = Object.keys(data.voteResults).find(key => key == voteId); // 使用 == 而不是 ===
        if (foundKey) {
            delete data.voteResults[foundKey];
            console.log(`✅ 通过宽松匹配删除投票结果: ${foundKey}`);
        }
    }
    
    // 3. 删除玩家投票记录
    Object.keys(data.playerVotes).forEach(voteKey => {
        if (voteKey.endsWith(`_${voteId}`)) {
            delete data.playerVotes[voteKey];
            console.log(`✅ 删除玩家记录: ${voteKey}`);
        }
    });
    
    writeVotesData(data);
    
    res.json({ success: true, message: '投票及相关结果已删除' });
});

// 提供前端页面
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// 初始化并启动服务器
initializeDataFiles();
app.listen(PORT, () => {
    console.log(`服务器运行在 http://0.0.0.0:${PORT}`);
});
