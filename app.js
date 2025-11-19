/**
 * 主应用逻辑
 * 连接UI、计算器和可视化器
 */

// 初始化
let calculator;
let visualizer;
let basicParamsVisualizer; // 基本参数tab的可视化器
let analyzer;

document.addEventListener('DOMContentLoaded', () => {
    // 初始化计算器和可视化器
    calculator = new GearCalculator();
    visualizer = new GearVisualizer('gearCanvas');
    basicParamsVisualizer = new GearVisualizer('basicParamsCanvas');
    // 设置基本参数可视化器的绘制后回调，用于绘制拟合圆
    basicParamsVisualizer.onAfterDraw = () => {
        drawFittedCircles();
    };
    analyzer = new GearAnalysis();

    // 绑定事件监听器
    setupEventListeners();
    setupTabs();
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
        setTimeout(() => drawRThetaPlot(), 100);

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
                    setTimeout(() => drawRThetaPlot(), 200);
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
 * 绘制r(theta)分析图，显示计算齿数的中间过程
 */
function drawRThetaPlot() {
    const canvas = document.getElementById('rThetaCanvas');
    if (!canvas) {
        console.warn('rThetaCanvas not found');
        return;
    }
    
    if (!analyzer.toothCountAnalysis) {
        // 如果没有分析数据，清空canvas并显示提示
        const ctx = canvas.getContext('2d');
        const width = canvas.width || 800;
        const height = canvas.height || 400;
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = '#999';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('暂无数据，请先加载轮廓文件', width / 2, height / 2);
        return;
    }

    const analysis = analyzer.toothCountAnalysis;
    const polarData = analysis.polarData;
    
    if (!polarData || polarData.length === 0) {
        const ctx = canvas.getContext('2d');
        const width = canvas.width || 800;
        const height = canvas.height || 400;
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = '#999';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('暂无数据', width / 2, height / 2);
        return;
    }

    // 设置canvas尺寸
    const container = canvas.parentElement;
    if (!container) {
        console.warn('rThetaCanvas parent container not found');
        return;
    }
    
    // 获取容器宽度，如果为0则使用默认值
    let containerWidth = container.clientWidth;
    if (containerWidth === 0) {
        // 如果容器宽度为0，尝试从父元素获取
        const parent = container.parentElement;
        if (parent) {
            containerWidth = parent.clientWidth || 800;
        } else {
            containerWidth = 800;
        }
    }
    
    const width = Math.max(containerWidth - 40, 600);
    const height = 400;
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, width, height);

    // 计算数据范围
    const thetas = polarData.map(p => p.theta);
    const rValues = polarData.map(p => p.r);
    const minTheta = Math.min(...thetas);
    const maxTheta = Math.max(...thetas);
    const minR = Math.min(...rValues);
    const maxR = Math.max(...rValues);
    const rRange = maxR - minR || 1;

    // 设置边距
    const padding = { top: 40, right: 20, bottom: 60, left: 60 };
    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;

    // 绘制背景
    ctx.fillStyle = '#f9f9f9';
    ctx.fillRect(padding.left, padding.top, plotWidth, plotHeight);

    // 绘制坐标轴
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.beginPath();
    // X轴（角度）
    ctx.moveTo(padding.left, padding.top + plotHeight);
    ctx.lineTo(padding.left + plotWidth, padding.top + plotHeight);
    // Y轴（半径）
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, padding.top + plotHeight);
    ctx.stroke();

    // 绘制网格
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 0.5;
    // 垂直网格线（角度）
    const thetaSteps = 8;
    for (let i = 0; i <= thetaSteps; i++) {
        const x = padding.left + (plotWidth * i / thetaSteps);
        ctx.beginPath();
        ctx.moveTo(x, padding.top);
        ctx.lineTo(x, padding.top + plotHeight);
        ctx.stroke();
    }
    // 水平网格线（半径）
    const rSteps = 5;
    for (let i = 0; i <= rSteps; i++) {
        const y = padding.top + (plotHeight * i / rSteps);
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(padding.left + plotWidth, y);
        ctx.stroke();
    }

    // 绘制r(theta)曲线
    ctx.strokeStyle = '#0066cc';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < polarData.length; i++) {
        const x = padding.left + ((thetas[i] - minTheta) / (maxTheta - minTheta || 1)) * plotWidth;
        const y = padding.top + plotHeight - ((rValues[i] - minR) / rRange) * plotHeight;
        if (i === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    }
    ctx.stroke();

    // 绘制平滑后的r值（如果存在）
    if (analysis.smoothedR && analysis.smoothedR.length > 0) {
        ctx.strokeStyle = '#00aa00';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        for (let i = 0; i < analysis.smoothedR.length && i < polarData.length; i++) {
            const x = padding.left + ((thetas[i] - minTheta) / (maxTheta - minTheta || 1)) * plotWidth;
            const y = padding.top + plotHeight - ((analysis.smoothedR[i] - minR) / rRange) * plotHeight;
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.stroke();
        ctx.setLineDash([]);
    }

    // 绘制峰值点（齿顶）
    if (analysis.peaks && analysis.peaks.length > 0) {
        ctx.fillStyle = '#ff0000';
        ctx.strokeStyle = '#ff0000';
        analysis.peaks.forEach(peakIdx => {
            if (peakIdx < polarData.length) {
                const x = padding.left + ((thetas[peakIdx] - minTheta) / (maxTheta - minTheta || 1)) * plotWidth;
                const y = padding.top + plotHeight - ((rValues[peakIdx] - minR) / rRange) * plotHeight;
                ctx.beginPath();
                ctx.arc(x, y, 4, 0, 2 * Math.PI);
                ctx.fill();
            }
        });
    }

    // 绘制角度差（在下方子图）
    if (analysis.angleDiffs && analysis.angleDiffs.length > 0) {
        const subPlotHeight = 80;
        const subPlotY = height - subPlotHeight;
        
        // 绘制角度差背景
        ctx.fillStyle = '#f0f0f0';
        ctx.fillRect(padding.left, subPlotY, plotWidth, subPlotHeight - padding.bottom);

        // 计算角度差的范围
        const maxDiff = Math.max(...analysis.angleDiffs);
        const avgDiff = analysis.angleDiffs.reduce((a, b) => a + b, 0) / analysis.angleDiffs.length;
        const threshold = avgDiff * 2.5;

        // 绘制角度差柱状图
        ctx.fillStyle = '#ff9900';
        const barWidth = plotWidth / analysis.angleDiffs.length;
        analysis.angleDiffs.forEach((diff, i) => {
            const barHeight = (diff / maxDiff) * (subPlotHeight - padding.bottom - 10);
            const x = padding.left + i * barWidth;
            const y = subPlotY + (subPlotHeight - padding.bottom) - barHeight;
            ctx.fillRect(x, y, barWidth - 1, barHeight);
            
            // 标记超过阈值的点
            if (diff > threshold) {
                ctx.fillStyle = '#ff0000';
                ctx.fillRect(x, y, barWidth - 1, barHeight);
                ctx.fillStyle = '#ff9900';
            }
        });

        // 绘制阈值线
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        const thresholdY = subPlotY + (subPlotHeight - padding.bottom) - (threshold / maxDiff) * (subPlotHeight - padding.bottom - 10);
        ctx.beginPath();
        ctx.moveTo(padding.left, thresholdY);
        ctx.lineTo(padding.left + plotWidth, thresholdY);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    // 绘制坐标轴标签
    ctx.fillStyle = '#333';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('角度 θ (弧度)', padding.left + plotWidth / 2, height - padding.bottom + 10);

    ctx.save();
    ctx.translate(15, padding.top + plotHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText('半径 r (mm)', 0, 0);
    ctx.restore();

    // 绘制图例和计算结果
    ctx.fillStyle = '#333';
    ctx.font = '11px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    
    let legendY = 10;
    ctx.fillText('方法1 (角度差): ' + (analysis.method1 || 0) + ' 齿', padding.left + plotWidth + 10, legendY);
    legendY += 20;
    ctx.fillText('方法2 (峰值): ' + (analysis.method2 || 0) + ' 齿', padding.left + plotWidth + 10, legendY);
    legendY += 20;
    ctx.fillText('方法3 (周期性): ' + (analysis.method3 || 0) + ' 齿', padding.left + plotWidth + 10, legendY);
    legendY += 20;
    ctx.fillStyle = '#0066cc';
    ctx.font = '12px Arial';
    ctx.fontWeight = 'bold';
    ctx.fillText('最终结果: ' + (analysis.final || 0) + ' 齿', padding.left + plotWidth + 10, legendY);

    // 绘制图例
    legendY += 30;
    ctx.font = '10px Arial';
    ctx.fillStyle = '#0066cc';
    ctx.fillRect(padding.left + plotWidth + 10, legendY, 15, 2);
    ctx.fillStyle = '#333';
    ctx.fillText('r(θ) 原始', padding.left + plotWidth + 30, legendY - 5);
    
    legendY += 20;
    ctx.strokeStyle = '#00aa00';
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(padding.left + plotWidth + 10, legendY);
    ctx.lineTo(padding.left + plotWidth + 25, legendY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#333';
    ctx.fillText('平滑后', padding.left + plotWidth + 30, legendY - 5);
    
    legendY += 20;
    ctx.fillStyle = '#ff0000';
    ctx.beginPath();
    ctx.arc(padding.left + plotWidth + 17, legendY, 3, 0, 2 * Math.PI);
    ctx.fill();
    ctx.fillStyle = '#333';
    ctx.fillText('峰值点', padding.left + plotWidth + 30, legendY - 5);
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
