/**
 * 主应用逻辑
 * 连接UI、计算器和可视化器
 */

// 初始化
let calculator;
let visualizer;
let analyzer;

document.addEventListener('DOMContentLoaded', () => {
    // 初始化计算器和可视化器
    calculator = new GearCalculator();
    visualizer = new GearVisualizer('gearCanvas');
    analyzer = new GearAnalysis();

    // 绑定事件监听器
    setupEventListeners();
    setupCollapsiblePanels();
    setupFileUploads();

    // 初始状态
    updateStatus('就绪', 'success');
});

/**
 * 设置文件上传
 */
function setupFileUploads() {
    // 轮廓文件上传
    const fileSelectBtn = document.getElementById('fileSelectBtn');
    const profileFile = document.getElementById('profileFile');
    const fileName = document.getElementById('fileName');

    if (fileSelectBtn && profileFile) {
        fileSelectBtn.addEventListener('click', () => profileFile.click());
        
        profileFile.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            fileName.textContent = file.name;
            updateStatus('正在读取文件...', 'warning');

            try {
                const content = await readFileAsText(file);
                const points = analyzer.parseProfileFile(content, file.name);
                
                if (points.length > 0) {
                    analyzer.profilePoints = points;
                    document.getElementById('fileInfo').textContent = `已加载 ${points.length} 个点`;
                    
                    // 绘制轮廓
                    visualizer.drawProfile(points);
                    
                    // 自动分析
                    analyzeProfile();
                    updateStatus('文件加载成功', 'success');
                } else {
                    updateStatus('文件格式错误或为空', 'error');
                }
            } catch (error) {
                console.error('文件读取错误:', error);
                updateStatus('文件读取失败: ' + error.message, 'error');
            }
        });
    }

    // CAD文件上传
    const cadFileSelectBtn = document.getElementById('cadFileSelectBtn');
    const cadFile = document.getElementById('cadFile');
    const cadFileName = document.getElementById('cadFileName');

    if (cadFileSelectBtn && cadFile) {
        cadFileSelectBtn.addEventListener('click', () => cadFile.click());
        
        cadFile.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            cadFileName.textContent = file.name;
            updateStatus('正在读取CAD文件...', 'warning');

            try {
                const content = await readFileAsText(file);
                const points = analyzer.parseDXFFile(content);
                
                if (points.length > 0) {
                    analyzer.cadPoints = points;
                    document.getElementById('cadFileInfo').textContent = `已加载 ${points.length} 个CAD点`;
                    updateStatus('CAD文件加载成功', 'success');
                } else {
                    updateStatus('CAD文件格式错误或为空', 'error');
                }
            } catch (error) {
                console.error('CAD文件读取错误:', error);
                updateStatus('CAD文件读取失败: ' + error.message, 'error');
            }
        });
    }

    // 配准按钮
    const registerBtn = document.getElementById('registerBtn');
    if (registerBtn) {
        registerBtn.addEventListener('click', performRegistration);
    }
}

/**
 * 读取文件为文本
 */
function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(new Error('文件读取失败'));
        reader.readAsText(file);
    });
}

/**
 * 分析轮廓
 */
function analyzeProfile() {
    if (analyzer.profilePoints.length < 3) {
        updateStatus('轮廓点数据不足', 'error');
        return;
    }

    try {
        updateStatus('正在分析...', 'warning');

        // 1. 计算极坐标
        const polarData = analyzer.calculatePolarCoordinates(analyzer.profilePoints);

        // 2. FFT分析计算齿数
        const toothCount = analyzer.calculateToothCountByFFT(polarData);
        analyzer.toothCount = toothCount;
        document.getElementById('toothCountResult').textContent = toothCount.toFixed(0);

        // 3. 拟合齿顶圆和齿根圆
        const circles = analyzer.fitAddendumAndDedendumCircles(analyzer.profilePoints, toothCount);
        if (circles) {
            analyzer.addendumRadius = circles.addendumRadius;
            analyzer.dedendumRadius = circles.dedendumRadius;
            
            document.getElementById('addendumDiameter').textContent = (circles.addendumRadius * 2).toFixed(3);
            document.getElementById('dedendumDiameter').textContent = (circles.dedendumRadius * 2).toFixed(3);
        }

        // 4. 获取分度圆直径
        const pitchDiameterInput = document.getElementById('pitchDiameterInput');
        const pitchDiameter = parseFloat(pitchDiameterInput.value) || 0;
        if (pitchDiameter > 0) {
            document.getElementById('pitchDiameter').textContent = pitchDiameter.toFixed(3);
        }

        // 5. 计算跨棒距
        const ballDiameter = parseFloat(document.getElementById('ballDiameter').value) || 3;
        if (toothCount > 0 && pitchDiameter > 0 && ballDiameter > 0) {
            calculateSpanMeasurement(toothCount, pitchDiameter, ballDiameter);
        }

        // 6. 计算齿距误差
        let singlePitchError = 0;
        let cumulativePitchError = 0;
        if (pitchDiameter > 0 && toothCount > 0) {
            const errors = calculatePitchError(polarData, pitchDiameter, toothCount);
            singlePitchError = errors.single;
            cumulativePitchError = errors.cumulative;
        }

        // 7. 计算齿轮等级
        if (pitchDiameter > 0 && singlePitchError > 0) {
            calculateGearGrades(pitchDiameter, singlePitchError, cumulativePitchError, 0);
        }

        updateStatus('分析完成', 'success');
    } catch (error) {
        console.error('分析错误:', error);
        updateStatus('分析失败: ' + error.message, 'error');
    }
}

/**
 * 计算跨棒距
 */
function calculateSpanMeasurement(toothCount, pitchDiameter, ballDiameter) {
    // 估算模数和压力角
    const module = pitchDiameter / toothCount;
    const pressureAngle = 20; // 默认20度

    try {
        const results = calculator.calculateSpanMeasurement(
            module, toothCount, pressureAngle, ballDiameter, 1, 0.25
        );

        document.getElementById('spanMeasurement').textContent = results.spanMeasurement.toFixed(3);
        document.getElementById('spanTeeth').textContent = results.spanTeeth.toFixed(0);

        // 绘制跨棒距曲线图
        drawSpanPlot(results);
    } catch (error) {
        console.error('跨棒距计算错误:', error);
    }
}

/**
 * 绘制跨棒距曲线图（圆形bar图）
 */
function drawSpanPlot(spanData) {
    const canvas = document.getElementById('spanPlotCanvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width = canvas.offsetWidth;
    const height = canvas.height = canvas.offsetHeight;

    ctx.clearRect(0, 0, width, height);

    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 2 - 40;

    // 绘制圆形背景
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.stroke();

    // 绘制跨棒距bar（简化版，显示360度的分布）
    const toothCount = analyzer.toothCount || 20;
    const angleStep = (2 * Math.PI) / toothCount;

    ctx.fillStyle = '#0066cc';
    for (let i = 0; i < toothCount; i++) {
        const angle = i * angleStep - Math.PI / 2;
        const barLength = radius * 0.3; // 简化显示
        const x1 = centerX + radius * Math.cos(angle);
        const y1 = centerY + radius * Math.sin(angle);
        const x2 = centerX + (radius + barLength) * Math.cos(angle);
        const y2 = centerY + (radius + barLength) * Math.sin(angle);

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#0066cc';
        ctx.stroke();
    }

    // 标注
    ctx.fillStyle = '#333';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('跨棒距分布', centerX, centerY - radius - 20);
}

/**
 * 计算齿轮等级
 */
function calculateGearGrades(pitchDiameter, singlePitchError, cumulativePitchError, profileError) {
    const isoGrade = analyzer.calculateISOGrade(pitchDiameter, singlePitchError, cumulativePitchError, profileError);
    const jisGrade = analyzer.calculateJISGrade(pitchDiameter, singlePitchError, cumulativePitchError, profileError);
    const gbkGrade = analyzer.calculateGBKGrade(pitchDiameter, singlePitchError, cumulativePitchError, profileError);

    document.getElementById('isoGrade').textContent = isoGrade;
    document.getElementById('jisGrade').textContent = jisGrade;
    document.getElementById('gbkGrade').textContent = gbkGrade;
}

/**
 * 计算齿距误差
 */
function calculatePitchError(polarData, pitchDiameter, toothCount) {
    if (polarData.length < toothCount) return;

    const pitchRadius = pitchDiameter / 2;
    const expectedPitchAngle = (2 * Math.PI) / toothCount;

    // 计算每个齿的齿距
    const pitchErrors = [];
    let cumulativeError = 0;
    const cumulativeErrors = [0];

    for (let i = 1; i < polarData.length; i++) {
        const angleDiff = polarData[i].theta - polarData[i - 1].theta;
        // 处理角度跨越
        const normalizedAngle = angleDiff > 0 ? angleDiff : angleDiff + 2 * Math.PI;
        
        if (normalizedAngle > expectedPitchAngle * 0.5) {
            const error = (normalizedAngle - expectedPitchAngle) * pitchRadius;
            pitchErrors.push(error);
            cumulativeError += error;
            cumulativeErrors.push(cumulativeError);
        }
    }

    if (pitchErrors.length > 0) {
        const maxSingleError = Math.max(...pitchErrors.map(Math.abs)) * 1000; // 转为μm
        const maxCumulativeError = Math.max(...cumulativeErrors.map(Math.abs)) * 1000;

        document.getElementById('singlePitchError').textContent = maxSingleError.toFixed(2);
        document.getElementById('cumulativePitchError').textContent = maxCumulativeError.toFixed(2);

        // 绘制直方图
        drawPitchErrorHistogram(pitchErrors);

        return {
            single: maxSingleError,
            cumulative: maxCumulativeError
        };
    }

    return { single: 0, cumulative: 0 };
}

/**
 * 绘制齿距误差直方图
 */
function drawPitchErrorHistogram(pitchErrors) {
    const canvas = document.getElementById('pitchErrorCanvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width = canvas.offsetWidth;
    const height = canvas.height = canvas.offsetHeight;

    ctx.clearRect(0, 0, width, height);

    if (pitchErrors.length === 0) return;

    // 转换为微米
    const errors = pitchErrors.map(e => e * 1000);
    const min = Math.min(...errors);
    const max = Math.max(...errors);
    const range = max - min || 1;

    // 绘制直方图
    const barWidth = width / errors.length;
    const maxHeight = height - 40;

    ctx.fillStyle = '#0066cc';
    errors.forEach((error, i) => {
        const barHeight = (Math.abs(error) / range) * maxHeight;
        const x = i * barWidth;
        const y = height - barHeight - 20;
        
        ctx.fillRect(x, y, barWidth - 2, barHeight);
    });

    // 绘制坐标轴
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height - 20);
    ctx.lineTo(width, height - 20);
    ctx.stroke();

    // 标注
    ctx.fillStyle = '#333';
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('齿距误差 (μm)', width / 2, height - 5);
}

/**
 * 执行配准
 */
function performRegistration() {
    if (analyzer.profilePoints.length === 0) {
        updateStatus('请先加载轮廓文件', 'error');
        return;
    }

    if (analyzer.cadPoints.length < 3) {
        updateStatus('请先加载CAD文件', 'error');
        return;
    }

    try {
        updateStatus('正在配准...', 'warning');

        const result = analyzer.icpRegistration(analyzer.profilePoints, analyzer.cadPoints);
        analyzer.registrationTransform = result.transform;

        // 计算轮廓度误差
        const profileError = analyzer.calculateProfileError(
            analyzer.profilePoints,
            analyzer.cadPoints,
            result.transform
        );

        document.getElementById('profileError').textContent = profileError.toFixed(2);
        document.getElementById('registrationStatus').textContent = '已配准';

        // 绘制配准结果
        drawRegistrationResult();

        // 更新齿轮等级（包含轮廓度误差）
        const pitchDiameter = parseFloat(document.getElementById('pitchDiameterInput').value) || 0;
        const singlePitchError = parseFloat(document.getElementById('singlePitchError').textContent) || 0;
        const cumulativePitchError = parseFloat(document.getElementById('cumulativePitchError').textContent) || 0;
        
        if (pitchDiameter > 0) {
            calculateGearGrades(pitchDiameter, singlePitchError, cumulativePitchError, profileError);
        }

        updateStatus('配准完成', 'success');
    } catch (error) {
        console.error('配准错误:', error);
        updateStatus('配准失败: ' + error.message, 'error');
    }
}

/**
 * 绘制配准结果
 */
function drawRegistrationResult() {
    const canvas = document.getElementById('profileErrorCanvas');
    if (!canvas || !analyzer.registrationTransform) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width = canvas.offsetWidth;
    const height = canvas.height = canvas.offsetHeight;

    ctx.clearRect(0, 0, width, height);

    // 绘制CAD轮廓（黑色）
    if (analyzer.cadPoints.length > 0) {
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        analyzer.cadPoints.forEach((p, i) => {
            if (i === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
        });
        ctx.stroke();
    }

    // 绘制测量点（红色）
    if (analyzer.profilePoints.length > 0) {
        const transform = analyzer.registrationTransform;
        const sourceCenter = {
            x: analyzer.profilePoints.reduce((s, p) => s + p.x, 0) / analyzer.profilePoints.length,
            y: analyzer.profilePoints.reduce((s, p) => s + p.y, 0) / analyzer.profilePoints.length
        };

        ctx.strokeStyle = '#e74c3c';
        ctx.lineWidth = 1;
        ctx.beginPath();
        analyzer.profilePoints.forEach((p, i) => {
            const x = p.x - sourceCenter.x;
            const y = p.y - sourceCenter.y;
            const xr = x * Math.cos(transform.angle) - y * Math.sin(transform.angle);
            const yr = x * Math.sin(transform.angle) + y * Math.cos(transform.angle);
            const transformed = {
                x: xr * transform.scale + sourceCenter.x + transform.tx,
                y: yr * transform.scale + sourceCenter.y + transform.ty
            };

            if (i === 0) ctx.moveTo(transformed.x, transformed.y);
            else ctx.lineTo(transformed.x, transformed.y);
        });
        ctx.stroke();
    }
}

/**
 * 设置可折叠面板
 */
function setupCollapsiblePanels() {
    const panelToggles = document.querySelectorAll('.panel-header-toggle');
    
    panelToggles.forEach(toggle => {
        toggle.addEventListener('click', (e) => {
            // 如果点击的是视图控制按钮，不触发折叠
            if (e.target.closest('.view-controls') || e.target.closest('.btn-icon')) {
                return;
            }
            
            const panel = toggle.closest('.collapsible-panel');
            if (panel) {
                panel.classList.toggle('active');
                const content = panel.querySelector('.panel-content');
                const icon = toggle.querySelector('.toggle-icon');
                
                if (panel.classList.contains('active')) {
                    content.style.display = '';
                    if (icon) icon.textContent = '▼';
                } else {
                    content.style.display = 'none';
                    if (icon) icon.textContent = '▶';
                }
            }
        });
    });
}

/**
 * 设置事件监听器
 */
function setupEventListeners() {
    // 计算按钮
    const calculateBtn = document.getElementById('calculateBtn');
    if (calculateBtn) {
        calculateBtn.addEventListener('click', () => {
            if (analyzer.profilePoints.length > 0) {
                analyzeProfile();
            } else {
                updateStatus('请先加载轮廓文件', 'error');
            }
        });
    }

    // 重置按钮
    const resetBtn = document.getElementById('resetBtn');
    if (resetBtn) {
        resetBtn.addEventListener('click', reset);
    }

    // 清空按钮
    const clearBtn = document.getElementById('clearBtn');
    if (clearBtn) {
        clearBtn.addEventListener('click', clearData);
    }

    // 输入框变化时自动计算
    const inputFields = ['ballDiameter', 'pitchDiameterInput'];
    inputFields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            field.addEventListener('input', debounce(() => {
                if (analyzer.profilePoints.length > 0) {
                    analyzeProfile();
                }
            }, 500));
        }
    });

    // 视图控制按钮
    const zoomInBtn = document.getElementById('zoomInBtn');
    if (zoomInBtn) {
        zoomInBtn.addEventListener('click', () => visualizer.zoomIn());
    }

    const zoomOutBtn = document.getElementById('zoomOutBtn');
    if (zoomOutBtn) {
        zoomOutBtn.addEventListener('click', () => visualizer.zoomOut());
    }

    const resetViewBtn = document.getElementById('resetViewBtn');
    if (resetViewBtn) {
        resetViewBtn.addEventListener('click', () => visualizer.resetView());
    }
}

/**
 * 重置所有数据
 */
function reset() {
    if (confirm('确定要重置所有数据吗？')) {
        analyzer.profilePoints = [];
        analyzer.cadPoints = [];
        analyzer.toothCount = 0;
        analyzer.registrationTransform = null;

        document.getElementById('profileFile').value = '';
        document.getElementById('cadFile').value = '';
        document.getElementById('fileName').textContent = '未选择文件';
        document.getElementById('cadFileName').textContent = '未选择文件';
        document.getElementById('fileInfo').textContent = '';
        document.getElementById('cadFileInfo').textContent = '';

        visualizer.drawProfile([]);
        updateStatus('已重置', 'success');
    }
}

/**
 * 清空数据
 */
function clearData() {
    analyzer.profilePoints = [];
    analyzer.cadPoints = [];
    visualizer.drawProfile([]);
    updateStatus('数据已清空', 'success');
}

/**
 * 更新状态指示器
 */
function updateStatus(message, type = 'success') {
    const indicator = document.getElementById('statusIndicator');
    const statusText = indicator.querySelector('.status-text');
    
    if (statusText) {
        statusText.textContent = message;
    }

    // 移除所有状态类
    indicator.classList.remove('success', 'warning', 'error');
    
    // 添加新状态类
    if (type !== 'success') {
        indicator.classList.add(type);
    }
}

/**
 * 防抖函数
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
