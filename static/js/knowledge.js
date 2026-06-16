/**
 * 智学通 - 知识图谱可视化JavaScript
 * 使用ECharts实现交互式知识关系图
 */

let graphChart = null;
let currentGraphData = null;

/**
 * 初始化知识图谱
 */
function initKnowledgeGraph(graphData) {
    currentGraphData = graphData;

    // 将配置数据转换为ECharts格式
    const { nodes, edges, categories } = buildGraphNodes(graphData);

    const option = buildGraphOption(nodes, edges, categories);
    graphChart = echarts.init(document.getElementById('knowledgeGraph'));
    graphChart.setOption(option);

    // 点击事件
    graphChart.on('click', function(params) {
        if (params.dataType === 'node') {
            showNodeDetail(params.data);
        }
    });

    // 自适应
    window.addEventListener('resize', () => graphChart?.resize());
}

/**
 * 构建图谱节点和边
 */
function buildGraphNodes(graphData) {
    const nodes = [];
    const edges = [];
    const categoryMap = {};
    let catIndex = 0;

    // 颜色方案
    const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4',
                    '#ec4899', '#14b8a6', '#f97316', '#3b82f6', '#84cc16', '#d946ef'];

    for (const [subject, categories] of Object.entries(graphData)) {
        // 添加学科节点
        if (!categoryMap[subject]) {
            categoryMap[subject] = { name: subject, index: catIndex, color: colors[catIndex % colors.length] };
            catIndex++;
        }
        nodes.push({
            name: subject,
            symbolSize: 55,
            category: categoryMap[subject].index,
            value: subject,
            itemStyle: {
                color: categoryMap[subject].color,
                shadowBlur: 15,
                shadowColor: categoryMap[subject].color + '60',
            }
        });

        for (const [catName, points] of Object.entries(categories)) {
            // 分类节点
            const catFullName = catName;
            nodes.push({
                name: catFullName,
                symbolSize: 35,
                category: categoryMap[subject].index,
                value: catFullName,
            });

            // 学科 → 分类 边
            edges.push({
                source: subject,
                target: catFullName,
                lineStyle: { color: categoryMap[subject].color + '60', width: 1.5 },
            });

            // 知识点节点
            for (const point of points) {
                const pointName = point;
                if (!nodes.find(n => n.name === pointName)) {
                    nodes.push({
                        name: pointName,
                        symbolSize: 20,
                        category: categoryMap[subject].index,
                        value: pointName,
                    });
                }

                // 分类 → 知识点 边
                edges.push({
                    source: catFullName,
                    target: pointName,
                    lineStyle: { color: categoryMap[subject].color + '30', width: 1 },
                });
            }
        }
    }

    // 去重
    const uniqueNodes = [];
    const seen = new Set();
    for (const node of nodes) {
        if (!seen.has(node.name)) {
            seen.add(node.name);
            uniqueNodes.push(node);
        }
    }

    return {
        nodes: uniqueNodes,
        edges,
        categories: Object.values(categoryMap).map(c => ({ name: c.name, itemStyle: { color: c.color } }))
    };
}

/**
 * 构建ECharts配置
 */
function buildGraphOption(nodes, edges, categories) {
    return {
        tooltip: {
            trigger: 'item',
            formatter: function(params) {
                if (params.dataType === 'node') {
                    return `<strong>${params.data.name}</strong><br/>
                            学科: ${categories[params.data.category]?.name || '未知'}<br/>
                            点击查看详情`;
                }
                return `${params.data.source} → ${params.data.target}`;
            }
        },
        legend: {
            data: categories.map(c => c.name),
            bottom: 10,
            textStyle: { fontSize: 12 },
            icon: 'roundRect',
        },
        series: [{
            type: 'graph',
            layout: 'force',
            force: {
                repulsion: 300,
                edgeLength: [80, 200],
                gravity: 0.1,
                friction: 0.6,
            },
            roam: true,
            draggable: true,
            categories: categories,
            data: nodes,
            edges: edges,
            // 节点样式
            itemStyle: {
                borderColor: '#fff',
                borderWidth: 2,
            },
            label: {
                show: true,
                position: 'right',
                fontSize: 11,
                color: '#334155',
                formatter: function(params) {
                    // 只显示主要节点标签
                    if (params.data.symbolSize >= 30) return params.name;
                    return params.name.length > 6 ? params.name.substring(0, 6) + '...' : params.name;
                }
            },
            emphasis: {
                focus: 'adjacency',
                itemStyle: {
                    shadowBlur: 20,
                    shadowColor: 'rgba(0,0,0,0.3)',
                },
                lineStyle: {
                    width: 3,
                },
            },
            lineStyle: {
                curveness: 0.2,
            },
        }]
    };
}

/**
 * 显示节点详情
 */
function showNodeDetail(nodeData) {
    const detail = document.getElementById('knowledgeDetail');
    if (!detail) return;

    detail.innerHTML = `
        <div class="p-3">
            <h6 class="mb-2">
                <i class="bi bi-bookmark-fill text-primary"></i>
                ${nodeData.name}
            </h6>
            <p class="small text-muted mb-2">
                所属分类: ${nodeData.value === nodeData.name ? '学科/分类' : '知识点'}
            </p>
            <div class="mb-3">
                <span class="badge bg-primary">点击查看相关资源</span>
            </div>
            <div class="d-flex gap-2">
                <button class="btn btn-sm btn-outline-primary" onclick="searchInChat('${nodeData.name}')">
                    <i class="bi bi-robot"></i> AI问答
                </button>
                <button class="btn btn-sm btn-outline-success" onclick="createNoteFor('${nodeData.name}')">
                    <i class="bi bi-pencil"></i> 记笔记
                </button>
            </div>
        </div>
    `;
}

/**
 * 高亮指定节点
 */
function highlightNode(nodeName) {
    if (!graphChart) return;

    graphChart.dispatchAction({
        type: 'highlight',
        name: nodeName
    });

    setTimeout(() => {
        graphChart.dispatchAction({
            type: 'downplay',
            name: nodeName
        });
    }, 3000);

    // 滚动到图谱区域
    document.getElementById('knowledgeGraph')?.scrollIntoView({ behavior: 'smooth' });
}

/**
 * 重置图谱
 */
function resetGraph() {
    if (graphChart && currentGraphData) {
        initKnowledgeGraph(currentGraphData);
        document.getElementById('knowledgeDetail').innerHTML = `
            <div class="text-center py-5 text-muted">
                <i class="bi bi-hand-index" style="font-size:2rem;"></i>
                <p class="mt-2">点击图谱中的节点查看详情</p>
            </div>
        `;
    }
}

/**
 * 筛选学科
 */
function filterSubject(subject, btn) {
    // 切换按钮样式
    document.querySelectorAll('.subject-filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    // 在图谱中高亮该学科相关节点
    if (graphChart) {
        const option = graphChart.getOption();
        // 重置所有节点大小
        if (option.series && option.series[0] && option.series[0].data) {
            option.series[0].data.forEach(node => {
                graphChart.dispatchAction({
                    type: 'highlight',
                    name: node.name
                });
            });
        }
    }
}

/**
 * 切换AI扩展图谱
 */
function toggleAIGraph(event) {
    const btn = event.target;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>AI分析中...';

    fetch('/api/knowledge-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: '请为计算机科学数据结构部分生成知识图谱' })
    })
    .then(r => r.json())
    .then(data => {
        if (data.success && data.graph) {
            // 合并AI生成的图谱
            const aiNodes = data.graph.nodes || [];
            const aiEdges = data.graph.edges || [];

            if (graphChart) {
                const option = graphChart.getOption();
                const existingData = option.series[0].data || [];
                const existingEdges = option.series[0].edges || [];

                // 追加新节点
                const newNodes = aiNodes.map(n => ({
                    name: n.name,
                    symbolSize: 25,
                    category: existingData[0]?.category || 0,
                    value: n.description || n.name,
                    itemStyle: { color: '#f59e0b' }
                }));

                const newEdges = aiEdges.map(e => ({
                    source: e.source,
                    target: e.target,
                    lineStyle: { color: '#f59e0b60', width: 1, type: 'dashed' }
                }));

                graphChart.setOption({
                    series: [{
                        data: [...existingData, ...newNodes],
                        edges: [...existingEdges, ...newEdges],
                    }]
                });
                showToast('AI知识图谱已加载', 'success');
            }
        } else {
            showToast('AI扩展功能需要配置API Key', 'warning');
        }
    })
    .catch(err => {
        showToast('网络错误: ' + err.message, 'error');
    })
    .finally(() => {
        btn.disabled = false;
        btn.innerHTML = '<i class="bi bi-robot"></i> AI扩展';
    });
}

/**
 * 跳转到AI聊天
 */
function searchInChat(topic) {
    window.location.href = '/chat?q=' + encodeURIComponent('请详细讲解：' + topic);
}

/**
 * 快速创建相关笔记
 */
function createNoteFor(topic) {
    const newNote = {
        title: topic + ' - 学习笔记',
        content: '# ' + topic + '\n\n## 概述\n\n## 核心要点\n\n## 学习心得\n',
        tags: topic,
        subject: '通用'
    };

    fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newNote)
    })
    .then(r => r.json())
    .then(data => {
        if (data.success) {
            showToast('笔记已创建，请在笔记页面查看', 'success');
        }
    });
}
