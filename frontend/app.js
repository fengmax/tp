// 全局变量
let currentPlayer = null;
let activeVotes = [];
let voteResults = {};

// API基础URL
const API_BASE = '/api';
    

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    checkExistingLogin();
    loadVotes();
    loadResults();
});

// 检查是否已有登录状态
function checkExistingLogin() {
    const savedPlayer = localStorage.getItem('currentPlayer');
    if (savedPlayer) {
        currentPlayer = JSON.parse(savedPlayer);
        updatePlayerStatus();
        document.getElementById('votingArea').classList.remove('hidden');
        document.getElementById('resultsArea').classList.remove('hidden');
    }
}

// 显示消息
function showMessage(elementId, message, type = 'error') {
    const element = document.getElementById(elementId);
    element.innerHTML = `<div class="${type}">${message}</div>`;
    element.classList.remove('hidden');
    
    if (type === 'success') {
        setTimeout(() => { element.classList.add('hidden'); }, 3001);
    }
}

// 玩家登录
async function loginPlayer() {
    const account = document.getElementById('playerAccount').value.trim();
    if (!account) {
        showMessage('playerStatus', '请输入账号');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ playerAccount: account })
        });
        
        const data = await response.json();
        
        if (data.success) {
    currentPlayer = data.player;
    localStorage.setItem('currentPlayer', JSON.stringify(currentPlayer));
    
    // 显示欢迎消息
    showMessage('playerStatus', `登录成功！欢迎 ${currentPlayer.account}，页面刷新中...`, 'success');
    
    // 短暂延迟后刷新
    setTimeout(() => {
        window.location.reload();
    }, 500);
        } else {
            showMessage('playerStatus', data.message);
        }
    } catch (error) {
        showMessage('playerStatus', '登录失败，请检查网络连接');
    }
}

// 更新玩家状态显示
function updatePlayerStatus() {
    if (!currentPlayer) return;
    
    const statusDiv = document.getElementById('playerStatus');
    statusDiv.innerHTML = `
        <div class="success">
            ✅ 欢迎！账号: <strong>${currentPlayer.account}</strong> | 
            等级: <strong>${currentPlayer.level}</strong> | 
            排名: <strong>第${currentPlayer.rank}名</strong> | 
            投票权重: <strong>${currentPlayer.weight}票</strong>
            <span class="weight-badge">${currentPlayer.weight === 2 ? '前2名加权' : '普通权重'}</span>
            <button class="btn" onclick="logoutPlayer()" style="margin-left: 15px; padding: 5px 15px; font-size: 12px;">
                退出
            </button>
        </div>
    `;
    statusDiv.classList.remove('hidden');
    document.getElementById('votingArea').classList.remove('hidden');
    document.getElementById('resultsArea').classList.remove('hidden');
}

// 玩家退出
function logoutPlayer() {
    currentPlayer = null;
    localStorage.removeItem('currentPlayer');
    document.getElementById('playerStatus').classList.add('hidden');
    document.getElementById('votingArea').classList.add('hidden');
    document.getElementById('resultsArea').classList.add('hidden');
   
}

// 管理员登录
async function loginAdmin() {
    const password = prompt('请输入管理员密码:');
    if (!password) return;
    
    try {
        const response = await fetch(`${API_BASE}/admin/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            localStorage.setItem('isAdmin', 'true');
            document.getElementById('adminPanel').classList.remove('hidden');
            renderAdminVotesList();
            showMessage('playerStatus', '管理员登录成功！', 'success');
        } else {
            alert(data.message);
        }
    } catch (error) {
        alert('管理员登录失败');
    }
}

// 切换管理员面板
function toggleAdminPanel() {
    const isAdmin = localStorage.getItem('isAdmin') === 'true';
    if (!isAdmin) {
        loginAdmin();
        return;
    }
    
    const panel = document.getElementById('adminPanel');
    panel.classList.toggle('hidden');
    if (!panel.classList.contains('hidden')) {
        renderAdminVotesList();
    }
}

// 管理员退出
function logoutAdmin() {
    localStorage.removeItem('isAdmin');
    document.getElementById('adminPanel').classList.add('hidden');
    showMessage('playerStatus', '管理员已退出', 'success');
}

// 处理玩家文件上传
function handlePlayerFileUpload(file) {
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const players = JSON.parse(e.target.result);
            
            if (!Array.isArray(players)) {
                throw new Error('文件格式错误：应该是一个数组');
            }
            
            const invalidPlayers = players.filter(item => !item.account);
            if (invalidPlayers.length > 0) {
                throw new Error('文件包含没有account字段的数据');
            }
            
            // 上传到服务器
            const response = await fetch(`${API_BASE}/players/upload`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ players })
            });
            
            const data = await response.json();
            
            if (data.success) {
                showMessage('playerUploadStatus', data.message, 'success');
            } else {
                showMessage('playerUploadStatus', data.message);
            }
        } catch (error) {
            showMessage('playerUploadStatus', '文件解析失败: ' + error.message);
        }
    };
    reader.readAsText(file);
}

// 添加投票选项
function addOption() {
    const optionInputs = document.getElementById('optionInputs');
    const optionCount = optionInputs.children.length + 1;
    const newOption = document.createElement('div');
    newOption.className = 'option-input-group';
    newOption.innerHTML = `
        <input type="text" placeholder="选项${optionCount}">
        <button type="button" class="btn" onclick="removeOption(this)">删除</button>
    `;
    optionInputs.appendChild(newOption);
}

// 删除投票选项
function removeOption(button) {
    if (document.getElementById('optionInputs').children.length > 2) {
        button.parentElement.remove();
    } else {
        alert('至少需要两个选项');
    }
}

// 创建投票
async function createVote() {
    const topic = document.getElementById('voteTopic').value.trim();
    const description = document.getElementById('voteDescription').value.trim();
    const type = document.getElementById('voteType').value;
    
    if (!topic) {
        alert('请输入投票主题');
        return;
    }
    
    const optionInputs = document.getElementById('optionInputs').querySelectorAll('input');
    const options = Array.from(optionInputs)
        .map(input => input.value.trim())
        .filter(text => text !== '');
    
    if (options.length < 2) {
        alert('至少需要两个有效选项');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/votes/create`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ topic, description, type, options })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('投票创建成功！');
            // 清空表单
            document.getElementById('voteTopic').value = '';
            document.getElementById('voteDescription').value = '';
            document.getElementById('optionInputs').innerHTML = `
                <div class="option-input-group">
                    <input type="text" placeholder="选项1">
                    <button type="button" class="btn" onclick="removeOption(this)">删除</button>
                </div>
                <div class="option-input-group">
                    <input type="text" placeholder="选项2">
                    <button type="button" class="btn" onclick="removeOption(this)">删除</button>
                </div>
            `;
            
            // 重新加载投票
            loadVotes();
            renderAdminVotesList();
        } else {
            alert(data.message);
        }
    } catch (error) {
        alert('创建投票失败');
    }
}

// 加载进行中的投票
async function loadVotes() {
    try {
        const response = await fetch(`${API_BASE}/votes/active`);
        activeVotes = await response.json();
        renderVotes();
    } catch (error) {
        console.error('加载投票失败:', error);
    }
}

// 渲染投票列表
function renderVotes() {
    const votingSection = document.getElementById('votingSection');
    
    if (activeVotes.length === 0) {
        votingSection.innerHTML = '<p style="color: white; text-align: center;">暂无进行中的投票</p>';
        return;
    }
    
    votingSection.innerHTML = activeVotes.map(vote => `
        <div class="vote-card">
            <div class="vote-header">
                <h3 class="vote-title">${vote.topic}</h3>
                <p class="vote-description">${vote.description}</p>
            </div>
            <div class="options-list">
                ${vote.options.map(option => `
                    <div class="option-item" onclick="toggleOption('${vote.id}', '${option.id}')">
                        <input type="${vote.type === 'multiple' ? 'checkbox' : 'radio'}" 
                               class="option-checkbox" 
                               name="vote_${vote.id}" 
                               value="${option.id}">
                        <span class="option-text">${option.text}</span>
                    </div>
                `).join('')}
            </div>
            <div class="vote-stats">
                <div class="stat-item">
                    <span>投票类型:</span>
                    <span class="stat-value">${vote.type === 'single' ? '单选' : '多选'}</span>
                </div>
                <div class="stat-item">
                    <span>总票数:</span>
                    <span class="stat-value">${vote.totalVotes || 0}</span>
                </div>
            </div>
            <button class="btn" onclick="submitVote('${vote.id}')" style="margin-top: 15px; width: 100%;">
                提交投票
            </button>
        </div>
    `).join('');
}

// 切换选项选择
function toggleOption(voteId, optionId) {
    if (!currentPlayer) {
        alert('请先登录');
        return;
    }
    
    const vote = activeVotes.find(v => v.id === voteId);
    if (!vote) return;
    
    const optionItem = event.currentTarget;
    const checkbox = optionItem.querySelector('input');
    
    if (vote.type === 'single') {
        // 单选：取消其他选项
        document.querySelectorAll(`input[name="vote_${voteId}"]`).forEach(input => {
            input.checked = false;
            input.closest('.option-item').classList.remove('selected');
        });
    }
    
    checkbox.checked = !checkbox.checked;
    optionItem.classList.toggle('selected', checkbox.checked);
}

// 提交投票
async function submitVote(voteId) {
    if (!currentPlayer) {
        alert('请先登录');
        return;
    }
    
    const selectedCheckboxes = document.querySelectorAll(`input[name="vote_${voteId}"]:checked`);
    const selectedOptions = Array.from(selectedCheckboxes).map(cb => cb.value);
    
    if (selectedOptions.length === 0) {
        alert('请至少选择一个选项');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/votes/vote`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                voteId,
                selectedOptions,
                playerAccount: currentPlayer.account
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert(`投票成功！您的投票权重为 ${data.weight} 票`);
            loadVotes();
            loadResults();
        } else {            alert(data.message);
        }
    } catch (error) {
        alert('投票失败，请检查网络连接');
    }
}
// 加载投票结果
async function loadResults() {
    try {
        const response = await fetch(`${API_BASE}/votes/results`);
        voteResults = await response.json();
        renderResults();
    } catch (error) {
        console.error('加载结果失败:', error);
    }
}
// 渲染投票结果
function renderResults() {
    const resultsContainer = document.getElementById('resultsContainer');
    
    if (Object.keys(voteResults).length === 0) {
        resultsContainer.innerHTML = '<p style="text-align: center; color: #666;">暂无投票结果</p>';
        return;
    }
    
    resultsContainer.innerHTML = Object.entries(voteResults).map(([voteId, result]) => `
        <div class="result-card" style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin-bottom: 20px;">
            <h4 style="color: #333; margin-bottom: 15px;">${result.topic}</h4>
            <div style="margin-bottom: 10px; color: #666;">总票数: ${result.totalVotes}</div>
            ${Object.entries(result.options).map(([optionId, option]) => `
                <div class="result-item">
                    <div style="min-width: 150px; font-weight: bold;">${option.text}</div>
                    <div class="result-bar">
                        <div class="result-fill" style="width: ${option.percentage}%"></div>
                        <div class="result-percent">${option.percentage}%</div>
                    </div>
                    <div style="min-width: 60px; text-align: right; font-weight: bold;">
                        ${option.votes}票
                    </div>
                </div>
            `).join('')}
        </div>
    `).join('');
}
// 渲染管理员投票列表
async function renderAdminVotesList() {
    const adminVotesList = document.getElementById('adminVotesList');
    
    try {
        const response = await fetch(`${API_BASE}/votes/active`);
        const votes = await response.json();
        
        if (votes.length === 0) {
            adminVotesList.innerHTML = '<p style="color: #666; text-align: center;">暂无投票</p>';
            return;
        }
        
        adminVotesList.innerHTML = votes.map(vote => `
            <div class="vote-card" style="margin-bottom: 15px; padding: 15px; border: 1px solid #ddd; border-radius: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
                    <div>
                        <h4 style="margin: 0 0 5px 0;">${vote.topic}</h4>
                        <p style="margin: 0; color: #666; font-size: 14px;">${vote.description}</p>
                    </div>
                    <button class="btn delete-btn" onclick="deleteVote('${vote.id}')">删除</button>
                </div>
                <div style="font-size: 14px; color: #666;">
                    类型: ${vote.type === 'single' ? '单选' : '多选'} | 
                    选项数: ${vote.options.length} | 
                    总票数: ${vote.totalVotes || 0}
                </div>
            </div>
        `).join('');
    } catch (error) {
        adminVotesList.innerHTML = '<p style="color: red;">加载失败</p>';
    }
}
// 删除投票
async function deleteVote(voteId) {
    if (!confirm('确定要删除这个投票吗？此操作不可撤销！')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/votes/${voteId}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('投票已删除');
            renderAdminVotesList();
            loadVotes();
            loadResults();
        } else {
            alert('删除失败');
        }
    } catch (error) {
        alert('删除失败，请检查网络连接');
    }
}
// 初始化示例数据
async function initializeSampleData() {
    try {
        // 检查是否已有数据
        const response = await fetch(`${API_BASE}/players`);
        const players = await response.json();
        
        if (players.length === 0) {
            // 上传示例玩家数据
            const samplePlayers = [
                { account: "player1", level: 50, password: "123456" },
                { account: "player2", level: 45, password: "123456" },
                { account: "player3", level: 40, password: "123456" },
                { account: "player4", level: 35, password: "123456" },
                { account: "player5", level: 30, password: "123456" }
            ];
            
            await fetch(`${API_BASE}/players/upload`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ players: samplePlayers })
            });
            
            console.log('示例数据初始化完成');
        }
    } catch (error) {
        console.error('初始化示例数据失败:', error);
    }
}
// 页面加载完成后初始化
window.onload = function() {
    initializeSampleData();
};
