/**
 * 主应用逻辑
 * 连接UI、计算器和可视化器
 */

// 初始化
let calculator;
let visualizer;
let basicParamsVisualizer; // 基本参数tab的可视化器
let analyzer;

// r(θ)图的视图状态
let rThetaViewState = {
    offsetX: 0,      // 水平偏移（像素）
    scale: 1,        // 缩放比例
    isDragging: false,
    dragStartX: 0,
    dragStartOffset: 0,
    minTheta: 0,
    maxTheta: 0,
    thetaRange: 0
};

document.addEventListener('DOMContentLoaded', async () => {
    // 检查所有必需的类是否已加载
    console.log('========== 检查依赖类 ==========');
    console.log('GearCalculator:', typeof GearCalculator);
    console.log('GearVisualizer:', typeof GearVisualizer);
    console.log('GearFileParser:', typeof GearFileParser);
    console.log('GearPointUtils:', typeof GearPointUtils);
    console.log('GearToothCount:', typeof GearToothCount);
    console.log('GearCircleFitting:', typeof GearCircleFitting);
    console.log('GearRegistration:', typeof GearRegistration);
    console.log('GearGrade:', typeof GearGrade);
    console.log('GearAnalysis:', typeof GearAnalysis);
    
    if (typeof GearToothCount === 'undefined') {
        console.error('错误：GearToothCount 未定义！请检查 gear-tooth-count.js 是否已正确加载');
        alert('错误：GearToothCount 类未加载。请检查浏览器控制台。');
        return;
    }
    
    // 初始化计算器和可视化器
    calculator = new GearCalculator();
    visualizer = new GearVisualizer('gearCanvas');
    basicParamsVisualizer = new GearVisualizer('basicParamsCanvas');
    // 设置基本参数可视化器的绘制后回调，用于绘制拟合圆
    basicParamsVisualizer.onAfterDraw = () => {
        drawFittedCircles();
    };
    
    try {
        analyzer = new GearAnalysis();
        console.log('analyzer 初始化成功');
    } catch (error) {
        console.error('analyzer 初始化失败:', error);
        alert('初始化失败: ' + error.message);
        return;
    }

    // 绑定事件监听器
    setupEventListeners();
    setupTabs();
    setupFileUploads();

    // 自动加载默认文件（延迟一点确保DOM完全加载）
    setTimeout(async () => {
        await loadDefaultFile();
    }, 100);
});

/**
 * 自动加载默认文件
 */
async function loadDefaultFile() {
    try {
        console.log('开始加载默认文件: 25-100刚轮-点.csv');
        updateStatus('正在加载默认文件...', 'warning');
        
        // 尝试多个可能的路径
        const possiblePaths = [
            '25-100刚轮-点.csv',
            './25-100刚轮-点.csv',
            'gear_analysis/25-100刚轮-点.csv'
        ];
        
        let content = null;
        let filePath = null;
        
        for (const path of possiblePaths) {
            try {
                console.log(`尝试路径: ${path}`);
                const response = await fetch(path);
                if (response.ok) {
                    content = await response.text();
                    filePath = path;
                    console.log(`成功从 ${path} 加载文件`);
                    break;
                }
            } catch (e) {
                console.log(`路径 ${path} 失败:`, e);
                continue;
            }
        }
        
        if (!content) {
            console.warn('无法从任何路径加载默认文件，请手动上传文件');
            updateStatus('默认文件未找到，请手动上传', 'warning');
            return;
        }
        
        console.log('文件内容长度:', content.length);
        const points = analyzer.parseProfileFile(content, '25-100刚轮-点.csv');
        console.log('解析得到点数:', points.length);
        
        if (points.length > 0) {
            analyzer.profilePoints = points;
            const fileNameEl = document.getElementById('fileName');
            const fileInfoEl = document.getElementById('fileInfo');
            
            if (fileNameEl) fileNameEl.textContent = '25-100刚轮-点.csv';
            if (fileInfoEl) fileInfoEl.textContent = `已加载 ${points.length} 个点`;
            
            // 绘制轮廓
            visualizer.drawProfile(points);
            
            // 自动适应视图
            setTimeout(() => visualizer.fitToView(), 100);
            
            // 自动分析
            analyzeProfile();
            updateStatus('默认文件加载成功', 'success');
            console.log('默认文件加载和分析完成');
        } else {
            console.warn('文件解析后没有点数据');
            updateStatus('文件格式错误', 'error');
        }
    } catch (error) {
        console.error('加载默认文件失败:', error);
        updateStatus('加载默认文件失败: ' + error.message, 'error');
    }
}

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
                    
                    // 自动适应视图
                    setTimeout(() => visualizer.fitToView(), 100);
                    
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

        // 2. 计算齿数（使用多种方法综合分析）
        const toothCount = analyzer.calculateToothCountFromProfile(polarData);
        analyzer.toothCount = toothCount;
        document.getElementById('toothCountResult').textContent = toothCount.toFixed(0);
        
        // 确保分析数据已保存（用于r(θ)图显示）
        console.log('齿数计算结果:', toothCount);
        console.log('分析数据:', analyzer.toothCountAnalysis);

        // 3. 拟合齿顶圆和齿根圆
        const circles = analyzer.fitAddendumAndDedendumCircles(analyzer.profilePoints, toothCount);
        if (circles) {
            analyzer.addendumRadius = circles.addendumRadius;
            analyzer.dedendumRadius = circles.dedendumRadius;
            analyzer.circleCenterX = circles.centerX;
            analyzer.circleCenterY = circles.centerY;
            
            document.getElementById('addendumDiameter').textContent = (circles.addendumRadius * 2).toFixed(3);
            document.getElementById('dedendumDiameter').textContent = (circles.dedendumRadius * 2).toFixed(3);
        }

        // 4. 获取分度圆直径（用于其他计算，但不显示）
        const pitchDiameterInput = document.getElementById('pitchDiameterInput');
        const pitchDiameter = parseFloat(pitchDiameterInput.value) || 0;

        // 更新基本参数可视化（显示轮廓点和拟合圆）
        drawBasicParamsCircles();
        
        // 绘制r(theta)分析图（延迟确保数据已保存）
        setTimeout(() => {
            console.log('========== analyzeProfile 完成，准备绘制r(θ)图 ==========');
            console.log('analyzer.profilePoints:', analyzer.profilePoints ? `${analyzer.profilePoints.length} 个点` : 'null');
            console.log('analyzer.toothCountAnalysis:', analyzer.toothCountAnalysis);
            drawRThetaPlot();
        }, 300);

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
 * 设置Tab切换
 */
function setupTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-tab');
            
            // 移除所有活动状态
            tabButtons.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            // 激活当前Tab
            btn.classList.add('active');
            const targetContent = document.getElementById(`tab-${targetTab}`);
            if (targetContent) {
                targetContent.classList.add('active');
                
                // Tab切换时更新可视化
                if (targetTab === 'basic') {
                    drawBasicParamsCircles();
                    // 延迟绘制r(theta)图，确保canvas已初始化
                    setTimeout(() => {
                        console.log('========== Tab切换到basic，准备绘制r(θ)图 ==========');
                        // 如果还没有分析数据，但有轮廓点，重新计算
                        if (!analyzer.toothCountAnalysis && analyzer.profilePoints && analyzer.profilePoints.length > 0) {
                            console.log('Tab切换：重新计算分析数据');
                            const polarData = analyzer.calculatePolarCoordinates(analyzer.profilePoints);
                            analyzer.calculateToothCountFromProfile(polarData);
                        }
                        drawRThetaPlot();
                    }, 300);
                } else if (targetTab === 'span') {
                    updateSpanAnalysis();
                }
            }
        });
    });
}

/**
 * 设置事件监听器
 */
function setupEventListeners() {
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

    const fitToViewBtn = document.getElementById('fitToViewBtn');
    if (fitToViewBtn) {
        fitToViewBtn.addEventListener('click', () => visualizer.fitToView());
    }

    // 选框放大按钮
    const selectZoomBtn = document.getElementById('selectZoomBtn');
    if (selectZoomBtn) {
        selectZoomBtn.addEventListener('click', () => {
            const isActive = visualizer.toggleSelectionMode();
            selectZoomBtn.style.background = isActive ? 'var(--primary-color)' : '';
            selectZoomBtn.style.color = isActive ? 'var(--text-light)' : '';
        });
    }

    // 点大小调节滑块
    const pointSizeSlider = document.getElementById('pointSizeSlider');
    const pointSizeValue = document.getElementById('pointSizeValue');
    if (pointSizeSlider && pointSizeValue) {
        pointSizeSlider.addEventListener('input', (e) => {
            const size = parseFloat(e.target.value);
            pointSizeValue.textContent = size.toFixed(1);
            visualizer.setPointSize(size);
        });
    }

    // 保存/打印PDF按钮
    const savePrintBtn = document.getElementById('savePrintBtn');
    if (savePrintBtn) {
        savePrintBtn.addEventListener('click', savePrintPDF);
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

/**
 * 绘制基本参数的可视化（轮廓点和拟合圆）
 */
function drawBasicParamsCircles() {
    if (!basicParamsVisualizer) return;

    const toothCount = parseFloat(document.getElementById('toothCountResult').textContent) || 0;
    const addendumDiameter = parseFloat(document.getElementById('addendumDiameter').textContent) || 0;
    const dedendumDiameter = parseFloat(document.getElementById('dedendumDiameter').textContent) || 0;

    // 如果没有轮廓点，显示提示
    if (!analyzer.profilePoints || analyzer.profilePoints.length === 0) {
        const canvas = document.getElementById('basicParamsCanvas');
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#999';
            ctx.font = '16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('暂无数据', canvas.width / 2, canvas.height / 2);
        }
        return;
    }

    // 确保canvas已初始化
    if (basicParamsVisualizer.canvas.width === 0 || basicParamsVisualizer.canvas.height === 0) {
        basicParamsVisualizer.resizeCanvas();
    }
    
    // 使用可视化器绘制轮廓点
    basicParamsVisualizer.drawProfile(analyzer.profilePoints);
    
    // 自动适应视图
    setTimeout(() => {
        basicParamsVisualizer.fitToView();
        // 确保拟合圆也被绘制
        drawFittedCircles();
    }, 150);
}

/**
 * 在基本参数canvas上绘制拟合的齿顶圆和齿根圆
 */
function drawFittedCircles() {
    const canvas = document.getElementById('basicParamsCanvas');
    if (!canvas || !basicParamsVisualizer) return;

    const addendumDiameter = parseFloat(document.getElementById('addendumDiameter').textContent) || 0;
    const dedendumDiameter = parseFloat(document.getElementById('dedendumDiameter').textContent) || 0;

    if (addendumDiameter === 0 && dedendumDiameter === 0) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width / basicParamsVisualizer.dpr;
    const height = canvas.height / basicParamsVisualizer.dpr;

    // 获取轮廓中心点（用于坐标变换）
    const profileCenterX = basicParamsVisualizer.profileCenterX || 0;
    const profileCenterY = basicParamsVisualizer.profileCenterY || 0;

    // 获取拟合圆的中心（如果有）
    const circleCenterX = analyzer.circleCenterX || profileCenterX;
    const circleCenterY = analyzer.circleCenterY || profileCenterY;

    ctx.save();
    ctx.translate(width / 2 + basicParamsVisualizer.offsetX, height / 2 + basicParamsVisualizer.offsetY);
    ctx.scale(basicParamsVisualizer.zoom, basicParamsVisualizer.zoom);

    // 绘制齿根圆
    if (dedendumDiameter > 0) {
        ctx.strokeStyle = '#ff6b6b';
        ctx.lineWidth = 2 / basicParamsVisualizer.zoom;
        ctx.setLineDash([5 / basicParamsVisualizer.zoom, 5 / basicParamsVisualizer.zoom]);
        ctx.beginPath();
        ctx.arc(
            circleCenterX - profileCenterX,
            circleCenterY - profileCenterY,
            dedendumDiameter / 2,
            0,
            2 * Math.PI
        );
        ctx.stroke();
        ctx.setLineDash([]);
    }

    // 绘制齿顶圆
    if (addendumDiameter > 0) {
        ctx.strokeStyle = '#96ceb4';
        ctx.lineWidth = 2 / basicParamsVisualizer.zoom;
        ctx.setLineDash([5 / basicParamsVisualizer.zoom, 5 / basicParamsVisualizer.zoom]);
        ctx.beginPath();
        ctx.arc(
            circleCenterX - profileCenterX,
            circleCenterY - profileCenterY,
            addendumDiameter / 2,
            0,
            2 * Math.PI
        );
        ctx.stroke();
        ctx.setLineDash([]);
    }

    // 绘制标注
    ctx.font = `${12 / basicParamsVisualizer.zoom}px Arial`;
    ctx.fillStyle = '#333';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    
    if (addendumDiameter > 0) {
        const labelX = (circleCenterX - profileCenterX) + addendumDiameter / 2 + 10 / basicParamsVisualizer.zoom;
        const labelY = (circleCenterY - profileCenterY) - 20 / basicParamsVisualizer.zoom;
        ctx.fillText(`齿顶圆: ${addendumDiameter.toFixed(2)}mm`, labelX, labelY);
    }
    if (dedendumDiameter > 0) {
        const labelX = (circleCenterX - profileCenterX) + dedendumDiameter / 2 + 10 / basicParamsVisualizer.zoom;
        const labelY = (circleCenterY - profileCenterY) + 20 / basicParamsVisualizer.zoom;
        ctx.fillText(`齿根圆: ${dedendumDiameter.toFixed(2)}mm`, labelX, labelY);
    }

    ctx.restore();
}

/**
 * 绘制r(theta)分析图，显示排序后的r(theta)数据
 */
function drawRThetaPlot() {
    console.log('========== drawRThetaPlot 开始 ==========');
    const canvas = document.getElementById('rThetaCanvas');
    console.log('canvas元素:', canvas);
    
    if (!canvas) {
        console.error('rThetaCanvas not found! 检查HTML中是否有id="rThetaCanvas"的元素');
        return;
    }
    
    console.log('analyzer对象:', analyzer);
    console.log('analyzer.profilePoints:', analyzer.profilePoints ? `${analyzer.profilePoints.length} 个点` : 'null');
    console.log('analyzer.toothCountAnalysis:', analyzer.toothCountAnalysis);
    
    // 直接使用轮廓点计算极坐标（不依赖toothCountAnalysis）
    let polarData = null;
    if (analyzer.profilePoints && analyzer.profilePoints.length > 0) {
        console.log('从profilePoints计算极坐标...');
        polarData = analyzer.calculatePolarCoordinates(analyzer.profilePoints);
        console.log('计算得到极坐标数据:', polarData ? `${polarData.length} 个点` : 'null');
    } else if (analyzer.toothCountAnalysis && analyzer.toothCountAnalysis.polarData) {
        console.log('从toothCountAnalysis获取极坐标数据...');
        polarData = analyzer.toothCountAnalysis.polarData;
        console.log('获取到极坐标数据:', polarData ? `${polarData.length} 个点` : 'null');
    } else {
        console.warn('没有可用的数据源！');
    }
    
    if (!polarData || polarData.length === 0) {
        console.error('polarData为空或长度为0！');
        const ctx = canvas.getContext('2d');
        const width = 800;
        const height = 300;
        canvas.width = width;
        canvas.height = height;
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = '#999';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('暂无数据，请先加载轮廓文件', width / 2, height / 2);
        console.log('已绘制"暂无数据"提示');
        return;
    }
    
    console.log('polarData有效，开始绘制图表...');

    // 设置canvas尺寸
    const container = canvas.parentElement;
    console.log('container元素:', container);
    console.log('container.clientWidth:', container ? container.clientWidth : 'null');
    
    let width = 800;
    let height = 300;
    
    if (container) {
        const containerWidth = container.clientWidth;
        console.log('容器宽度:', containerWidth);
        if (containerWidth > 0) {
            width = Math.max(containerWidth - 40, 600);
        }
    }
    
    console.log('设置canvas尺寸:', width, 'x', height);
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
        console.error('无法获取canvas 2d上下文！');
        return;
    }
    
    ctx.clearRect(0, 0, width, height);
    console.log('canvas已清空');

    // 计算数据范围
    const thetas = polarData.map(p => p.theta);
    const rValues = polarData.map(p => p.r);
    const minTheta = Math.min(...thetas);
    const maxTheta = Math.max(...thetas);
    const thetaRange = maxTheta - minTheta || 1;
    const minR = Math.min(...rValues);
    const maxR = Math.max(...rValues);
    const rRange = maxR - minR || 1;
    
    console.log('数据范围:');
    console.log('  theta: [', minTheta.toFixed(4), ',', maxTheta.toFixed(4), '], range:', thetaRange.toFixed(4));
    console.log('  r: [', minR.toFixed(4), ',', maxR.toFixed(4), '], range:', rRange.toFixed(4));
    
    // 设置边距（简化布局）
    const padding = { top: 20, right: 15, bottom: 35, left: 50 };
    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;
    
    // 保存数据范围到视图状态
    rThetaViewState.minTheta = minTheta;
    rThetaViewState.maxTheta = maxTheta;
    rThetaViewState.thetaRange = thetaRange;
    
    // 应用视图变换（缩放和平移）
    // offsetX是像素偏移，需要转换为角度偏移
    const pixelsPerTheta = plotWidth / thetaRange;
    const thetaOffset = rThetaViewState.offsetX / pixelsPerTheta;
    const viewMinTheta = minTheta - thetaOffset;
    const viewMaxTheta = viewMinTheta + (thetaRange / rThetaViewState.scale);
    const viewThetaRange = viewMaxTheta - viewMinTheta;

    // 绘制背景（白色）
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(padding.left, padding.top, plotWidth, plotHeight);

    // 绘制坐标轴（更粗更清晰）
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 2;
    ctx.beginPath();
    // X轴（角度）
    ctx.moveTo(padding.left, padding.top + plotHeight);
    ctx.lineTo(padding.left + plotWidth, padding.top + plotHeight);
    // Y轴（半径）
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, padding.top + plotHeight);
    ctx.stroke();

    // 绘制网格（更淡，减少干扰）- 应用视图变换
    ctx.strokeStyle = '#e8e8e8';
    ctx.lineWidth = 1;
    // 垂直网格线（角度）- 根据视图范围动态计算
    const thetaSteps = 6;
    for (let i = 0; i <= thetaSteps; i++) {
        const theta = viewMinTheta + (viewThetaRange * i / thetaSteps);
        const x = padding.left + (plotWidth * i / thetaSteps);
        ctx.beginPath();
        ctx.moveTo(x, padding.top);
        ctx.lineTo(x, padding.top + plotHeight);
        ctx.stroke();
    }
    // 水平网格线（半径）- 减少网格线数量
    const rSteps = 4;
    for (let i = 1; i < rSteps; i++) {
        const y = padding.top + (plotHeight * i / rSteps);
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(padding.left + plotWidth, y);
        ctx.stroke();
    }

    // 绘制r(theta)曲线（排序后的数据）- 应用视图变换
    console.log('开始绘制r(theta)曲线，点数:', polarData.length);
    console.log('视图范围: theta [', viewMinTheta.toFixed(4), ',', viewMaxTheta.toFixed(4), ']');
    
    // 只绘制可见范围内的点
    ctx.strokeStyle = '#0066cc';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    let pointsDrawn = 0;
    let firstPoint = true;
    
    for (let i = 0; i < polarData.length; i++) {
        const theta = thetas[i];
        // 只绘制在视图范围内的点
        if (theta >= viewMinTheta && theta <= viewMaxTheta) {
            const x = padding.left + ((theta - viewMinTheta) / viewThetaRange) * plotWidth;
            const y = padding.top + plotHeight - ((rValues[i] - minR) / rRange) * plotHeight;
            if (firstPoint) {
                ctx.moveTo(x, y);
                firstPoint = false;
            } else {
                ctx.lineTo(x, y);
            }
            pointsDrawn++;
        }
    }
    ctx.stroke();
    console.log('已绘制', pointsDrawn, '个点（可见范围内）');

    // 绘制passline（半径平均值线）- 应用视图变换
    const avgR = rValues.reduce((a, b) => a + b, 0) / rValues.length;
    const passlineY = padding.top + plotHeight - ((avgR - minR) / rRange) * plotHeight;
    ctx.strokeStyle = '#ff9900';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(padding.left, passlineY);
    ctx.lineTo(padding.left + plotWidth, passlineY);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // 绘制passline标签
    ctx.fillStyle = '#ff9900';
    ctx.font = '10px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('passline (平均值)', padding.left + plotWidth - 120, passlineY - 5);

    // 如果有分析数据，显示峰值点 - 应用视图变换
    const analysis = analyzer.toothCountAnalysis;
    if (analysis && analysis.peaks && analysis.peaks.length > 0) {
        // 绘制峰值点（齿顶，超过passline的点）- 只绘制可见范围内的
        ctx.fillStyle = '#ff4444';
        analysis.peaks.forEach(peakIdx => {
            if (peakIdx < polarData.length) {
                const theta = thetas[peakIdx];
                // 只绘制在视图范围内的峰值
                if (theta >= viewMinTheta && theta <= viewMaxTheta) {
                    const x = padding.left + ((theta - viewMinTheta) / viewThetaRange) * plotWidth;
                    const y = padding.top + plotHeight - ((rValues[peakIdx] - minR) / rRange) * plotHeight;
                    ctx.beginPath();
                    ctx.arc(x, y, 2, 0, 2 * Math.PI);
                    ctx.fill();
                }
            }
        });
    }

    // 绘制坐标轴标签（更清晰）
    console.log('绘制坐标轴标签...');
    ctx.fillStyle = '#333333';
    ctx.font = '11px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('角度 θ (rad)', padding.left + plotWidth / 2, height - padding.bottom + 8);

    ctx.save();
    ctx.translate(12, padding.top + plotHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText('半径 r (mm)', 0, 0);
    ctx.restore();
    
    // 绘制刻度标签（简化）- 应用视图变换
    ctx.font = '9px Arial';
    ctx.fillStyle = '#666666';
    ctx.textAlign = 'center';
    // X轴刻度 - 使用视图范围
    for (let i = 0; i <= thetaSteps; i++) {
        const x = padding.left + (plotWidth * i / thetaSteps);
        const thetaValue = viewMinTheta + (viewThetaRange * i / thetaSteps);
        ctx.fillText(thetaValue.toFixed(2), x, height - padding.bottom + 18);
    }
    
    // 绘制视图控制提示
    ctx.fillStyle = '#999999';
    ctx.font = '9px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`缩放: ${rThetaViewState.scale.toFixed(2)}x | 拖拽查看 | 滚轮缩放`, padding.left, 10);
    // Y轴刻度
    ctx.textAlign = 'right';
    for (let i = 0; i <= rSteps; i++) {
        const y = padding.top + (plotHeight * i / rSteps);
        const rValue = minR + (maxR - minR) * (1 - i / rSteps);
        ctx.fillText(rValue.toFixed(1), padding.left - 8, y + 4);
    }
    
    console.log('========== drawRThetaPlot 完成 ==========');
    
    // 设置交互事件（如果还没有设置）
    setupRThetaInteractions(canvas);
}

/**
 * 设置r(θ)图的交互功能（拖拽和缩放）
 */
function setupRThetaInteractions(canvas) {
    // 避免重复绑定事件
    if (canvas._rThetaInteractionsSetup) return;
    canvas._rThetaInteractionsSetup = true;
    
    // 鼠标按下 - 开始拖拽
    canvas.addEventListener('mousedown', (e) => {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        rThetaViewState.isDragging = true;
        rThetaViewState.dragStartX = x;
        rThetaViewState.dragStartOffset = rThetaViewState.offsetX;
        canvas.style.cursor = 'grabbing';
    });
    
    // 鼠标移动 - 拖拽
    canvas.addEventListener('mousemove', (e) => {
        if (rThetaViewState.isDragging) {
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const deltaX = x - rThetaViewState.dragStartX;
            rThetaViewState.offsetX = rThetaViewState.dragStartOffset + deltaX;
            
            // 限制拖拽范围（防止拖出边界）
            const padding = { left: 50, right: 15 };
            const plotWidth = canvas.width - padding.left - padding.right;
            if (rThetaViewState.thetaRange > 0) {
                const maxOffset = (rThetaViewState.thetaRange * (1 - 1 / rThetaViewState.scale)) * (plotWidth / rThetaViewState.thetaRange);
                rThetaViewState.offsetX = Math.max(-maxOffset, Math.min(maxOffset, rThetaViewState.offsetX));
            }
            
            drawRThetaPlot();
        }
    });
    
    // 鼠标释放 - 结束拖拽
    canvas.addEventListener('mouseup', () => {
        rThetaViewState.isDragging = false;
        canvas.style.cursor = 'grab';
    });
    
    // 鼠标离开 - 结束拖拽
    canvas.addEventListener('mouseleave', () => {
        rThetaViewState.isDragging = false;
        canvas.style.cursor = 'default';
    });
    
    // 滚轮缩放
    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const padding = { left: 50, right: 15 };
        const plotWidth = canvas.width - padding.left - padding.right;
        
        // 计算鼠标位置对应的theta值（在缩放前）
        if (rThetaViewState.thetaRange > 0) {
            const oldScale = rThetaViewState.scale;
            const pixelsPerTheta = plotWidth / (rThetaViewState.thetaRange / oldScale);
            const thetaAtMouse = rThetaViewState.minTheta + 
                ((x - padding.left) / pixelsPerTheta) + (rThetaViewState.offsetX / pixelsPerTheta);
            
            // 缩放
            const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
            rThetaViewState.scale = Math.max(1, Math.min(20, rThetaViewState.scale * zoomFactor));
            
            // 调整offsetX，使鼠标位置的theta值保持不变
            const newPixelsPerTheta = plotWidth / (rThetaViewState.thetaRange / rThetaViewState.scale);
            const newThetaAtMouse = rThetaViewState.minTheta + 
                ((x - padding.left) / newPixelsPerTheta) + (rThetaViewState.offsetX / newPixelsPerTheta);
            
            const thetaDiff = newThetaAtMouse - thetaAtMouse;
            rThetaViewState.offsetX -= thetaDiff * newPixelsPerTheta;
        }
        
        drawRThetaPlot();
    });
    
    // 设置鼠标样式
    canvas.style.cursor = 'grab';
}

/**
 * 更新跨棒距分析（包括圆形直方图和表格）
 */
function updateSpanAnalysis() {
    const toothCount = analyzer.toothCount || 0;
    const pitchDiameter = parseFloat(document.getElementById('pitchDiameterInput').value) || 0;
    const ballDiameter = parseFloat(document.getElementById('ballDiameter').value) || 3;

    if (toothCount > 0 && pitchDiameter > 0) {
        calculateSpanMeasurement(toothCount, pitchDiameter, ballDiameter);
    }
}

/**
 * 更新跨棒距表格
 */
function updateSpanTable(spanData) {
    const tbody = document.querySelector('#spanTable tbody');
    if (!tbody) return;

    tbody.innerHTML = '';
    
    if (!spanData || !spanData.spanMeasurements) return;

    const toothCount = analyzer.toothCount || 20;
    const angleStep = 360 / toothCount;

    spanData.spanMeasurements.forEach((measurement, index) => {
        const angle = index * angleStep;
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${angle.toFixed(1)}</td>
            <td>${measurement.toFixed(3)}</td>
        `;
        tbody.appendChild(row);
    });
}

/**
 * 修改drawSpanPlot以支持圆形直方图和表格
 */
const originalDrawSpanPlot = drawSpanPlot;
drawSpanPlot = function(spanData) {
    originalDrawSpanPlot(spanData);
    updateSpanTable(spanData);
    
    // 重新绘制圆形直方图
    const canvas = document.getElementById('spanPlotCanvas');
    if (!canvas) return;

    const container = canvas.parentElement;
    const size = Math.min(container.clientWidth - 40, container.clientHeight - 40, 500);
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, size, size);

    const centerX = size / 2;
    const centerY = size / 2;
    const radius = size * 0.35;
    const toothCount = analyzer.toothCount || 20;
    const angleStep = (2 * Math.PI) / toothCount;

    // 绘制圆形背景
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.stroke();

    if (spanData && spanData.spanMeasurements) {
        const measurements = spanData.spanMeasurements;
        const min = Math.min(...measurements);
        const max = Math.max(...measurements);
        const range = max - min || 1;

        // 绘制跨棒距bar
        ctx.fillStyle = '#0066cc';
        ctx.strokeStyle = '#0066cc';
        ctx.lineWidth = 2;

        measurements.forEach((measurement, i) => {
            const angle = i * angleStep - Math.PI / 2;
            const barLength = ((measurement - min) / range) * radius * 0.4;
            const x1 = centerX + radius * Math.cos(angle);
            const y1 = centerY + radius * Math.sin(angle);
            const x2 = centerX + (radius + barLength) * Math.cos(angle);
            const y2 = centerY + (radius + barLength) * Math.sin(angle);

            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
        });
    }

    // 标注
    ctx.fillStyle = '#333';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('跨棒距分布', centerX, centerY - radius - 30);
};

/**
 * 保存/打印PDF
 */
function savePrintPDF() {
    if (typeof window.jspdf === 'undefined') {
        alert('PDF库未加载，请检查网络连接');
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');

    // 标题
    doc.setFontSize(18);
    doc.text('齿轮分析报告', 105, 20, { align: 'center' });

    let yPos = 35;

    // 基本参数
    doc.setFontSize(14);
    doc.text('基本参数', 20, yPos);
    yPos += 10;

    doc.setFontSize(11);
    const toothCount = document.getElementById('toothCountResult').textContent;
    const addendumDiameter = document.getElementById('addendumDiameter').textContent;
    const dedendumDiameter = document.getElementById('dedendumDiameter').textContent;

    doc.text(`齿数 (Z): ${toothCount}`, 25, yPos);
    yPos += 7;
    doc.text(`齿顶圆直径: ${addendumDiameter} mm`, 25, yPos);
    yPos += 7;
    doc.text(`齿根圆直径: ${dedendumDiameter} mm`, 25, yPos);
    yPos += 15;

    // 跨棒距分析
    if (document.getElementById('spanMeasurement').textContent !== '-') {
        doc.setFontSize(14);
        doc.text('跨棒距分析', 20, yPos);
        yPos += 10;

        doc.setFontSize(11);
        const spanMeasurement = document.getElementById('spanMeasurement').textContent;
        const spanTeeth = document.getElementById('spanTeeth').textContent;
        doc.text(`跨棒距 (M): ${spanMeasurement} mm`, 25, yPos);
        yPos += 7;
        doc.text(`跨齿数: ${spanTeeth}`, 25, yPos);
        yPos += 15;
    }

    // 齿距误差
    if (document.getElementById('singlePitchError').textContent !== '-') {
        doc.setFontSize(14);
        doc.text('齿距误差', 20, yPos);
        yPos += 10;

        doc.setFontSize(11);
        const singlePitchError = document.getElementById('singlePitchError').textContent;
        const cumulativePitchError = document.getElementById('cumulativePitchError').textContent;
        doc.text(`单个齿距误差 (fp): ${singlePitchError} μm`, 25, yPos);
        yPos += 7;
        doc.text(`累计齿距误差 (Fp): ${cumulativePitchError} μm`, 25, yPos);
        yPos += 15;
    }

    // 轮廓误差
    if (document.getElementById('profileError').textContent !== '-') {
        doc.setFontSize(14);
        doc.text('轮廓误差', 20, yPos);
        yPos += 10;

        doc.setFontSize(11);
        const profileError = document.getElementById('profileError').textContent;
        doc.text(`轮廓度误差: ${profileError} μm`, 25, yPos);
        yPos += 15;
    }

    // 齿轮等级
    if (document.getElementById('isoGrade').textContent !== '-') {
        doc.setFontSize(14);
        doc.text('齿轮等级', 20, yPos);
        yPos += 10;

        doc.setFontSize(11);
        const isoGrade = document.getElementById('isoGrade').textContent;
        const jisGrade = document.getElementById('jisGrade').textContent;
        const gbkGrade = document.getElementById('gbkGrade').textContent;
        doc.text(`ISO 等级: ${isoGrade}`, 25, yPos);
        yPos += 7;
        doc.text(`JIS 等级: ${jisGrade}`, 25, yPos);
        yPos += 7;
        doc.text(`GBK 等级: ${gbkGrade}`, 25, yPos);
    }

    // 保存PDF
    const fileName = `齿轮分析报告_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
    
    updateStatus('PDF已生成', 'success');
}
