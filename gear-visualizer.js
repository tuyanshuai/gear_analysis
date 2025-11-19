/**
 * 齿轮可视化器
 * 使用Canvas绘制齿轮图形
 */

class GearVisualizer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            throw new Error(`Canvas element with id "${canvasId}" not found`);
        }
        this.ctx = this.canvas.getContext('2d');
        this.zoom = 1.0;
        this.offsetX = 0;
        this.offsetY = 0;
        this.isDragging = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;
        this.pointSize = 0.5; // 默认点大小（更小）
        this.isSelecting = false; // 是否正在选框
        this.selectStartX = 0;
        this.selectStartY = 0;
        this.selectEndX = 0;
        this.selectEndY = 0;
        this.dpr = window.devicePixelRatio || 1; // 设备像素比，用于高DPI支持
        this.onAfterDraw = null; // 绘制完成后的回调函数
        
        this.setupCanvas();
        this.setupEventListeners();
    }

    setupCanvas() {
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    resizeCanvas() {
        const container = this.canvas.parentElement;
        const width = container.clientWidth;
        const height = container.clientHeight;
        
        // 设置高DPI支持，提高清晰度
        this.canvas.width = width * this.dpr;
        this.canvas.height = height * this.dpr;
        this.canvas.style.width = width + 'px';
        this.canvas.style.height = height + 'px';
        
        // 重置变换并缩放上下文以匹配设备像素比
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.scale(this.dpr, this.dpr);
        
        this.draw();
    }

    setupEventListeners() {
        // 鼠标拖动
        this.canvas.addEventListener('mousedown', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            if (this.isSelecting) {
                // 选框模式：开始选择
                this.selectStartX = x;
                this.selectStartY = y;
                this.selectEndX = x;
                this.selectEndY = y;
            } else {
                // 普通拖动模式
                this.isDragging = true;
                this.lastMouseX = e.clientX;
                this.lastMouseY = e.clientY;
            }
        });

        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            if (this.isSelecting && this.selectStartX !== 0 && this.selectStartY !== 0) {
                // 更新选框结束位置
                this.selectEndX = x;
                this.selectEndY = y;
                this.draw();
            } else if (this.isDragging && !this.isSelecting) {
                const dx = e.clientX - this.lastMouseX;
                const dy = e.clientY - this.lastMouseY;
                this.offsetX += dx;
                this.offsetY += dy;
                this.lastMouseX = e.clientX;
                this.lastMouseY = e.clientY;
                this.draw();
            }
        });

        this.canvas.addEventListener('mouseup', (e) => {
            if (this.isSelecting && this.selectStartX !== 0 && this.selectStartY !== 0) {
                // 完成选框，执行放大
                this.zoomToSelection();
                this.isSelecting = false;
                this.selectStartX = 0;
                this.selectStartY = 0;
                this.selectEndX = 0;
                this.selectEndY = 0;
                this.draw();
            }
            this.isDragging = false;
        });

        this.canvas.addEventListener('mouseleave', () => {
            if (this.isSelecting) {
                this.isSelecting = false;
                this.selectStartX = 0;
                this.selectStartY = 0;
                this.selectEndX = 0;
                this.selectEndY = 0;
                this.draw();
            }
            this.isDragging = false;
        });

        // 鼠标滚轮缩放
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            this.zoom *= delta;
            this.zoom = Math.max(0.1, Math.min(1000, this.zoom));
            this.draw();
            this.updateZoomDisplay();
        });
    }

    setZoom(zoom) {
        this.zoom = Math.max(0.1, Math.min(1000, zoom));
        this.draw();
        this.updateZoomDisplay();
    }

    zoomIn() {
        this.setZoom(this.zoom * 1.2);
    }

    zoomOut() {
        this.setZoom(this.zoom * 0.8);
    }

    resetView() {
        this.zoom = 1.0;
        this.offsetX = 0;
        this.offsetY = 0;
        this.draw();
        this.updateZoomDisplay();
    }

    fitToView() {
        // 如果没有轮廓点，使用默认视图
        if (!this.profilePoints || this.profilePoints.length === 0) {
            this.resetView();
            return;
        }

        // 计算数据范围
        const xs = this.profilePoints.map(p => p.x);
        const ys = this.profilePoints.map(p => p.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);

        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        const rangeX = maxX - minX;
        const rangeY = maxY - minY;
        const maxRange = Math.max(rangeX, rangeY);

        // 计算画布可用区域（留出边距）
        const padding = 40; // 边距（像素）
        const canvasWidth = this.canvas.width / this.dpr;
        const canvasHeight = this.canvas.height / this.dpr;
        const availableWidth = canvasWidth - padding * 2;
        const availableHeight = canvasHeight - padding * 2;

        // 计算合适的缩放比例
        const scaleX = availableWidth / rangeX;
        const scaleY = availableHeight / rangeY;
        const newZoom = Math.min(scaleX, scaleY) * 0.9; // 0.9 是为了留出一些边距

        // 限制缩放范围
        this.zoom = Math.max(0.1, Math.min(1000, newZoom));

        // 重置偏移，让轮廓居中显示
        this.offsetX = 0;
        this.offsetY = 0;

        // 保存中心点供绘制时使用
        this.profileCenterX = centerX;
        this.profileCenterY = centerY;

        this.draw();
        this.updateZoomDisplay();
    }

    updateZoomDisplay() {
        const zoomDisplay = document.getElementById('zoomLevel');
        if (zoomDisplay) {
            zoomDisplay.textContent = this.zoom.toFixed(2) + 'x';
        }
    }

    /**
     * 设置点的大小
     * @param {number} size - 点的大小（像素）
     */
    setPointSize(size) {
        this.pointSize = Math.max(0.1, Math.min(10, size));
        this.draw();
    }

    /**
     * 启用/禁用选框模式
     */
    toggleSelectionMode() {
        this.isSelecting = !this.isSelecting;
        this.canvas.style.cursor = this.isSelecting ? 'crosshair' : 'default';
        return this.isSelecting;
    }

    /**
     * 放大到选中的区域
     */
    zoomToSelection() {
        if (!this.profilePoints || this.profilePoints.length === 0) return;

        const width = this.canvas.width / this.dpr;
        const height = this.canvas.height / this.dpr;

        // 计算选中区域的中心点和大小（屏幕坐标）
        const selectX = Math.min(this.selectStartX, this.selectEndX);
        const selectY = Math.min(this.selectStartY, this.selectEndY);
        const selectWidth = Math.abs(this.selectEndX - this.selectStartX);
        const selectHeight = Math.abs(this.selectEndY - this.selectStartY);

        if (selectWidth < 10 || selectHeight < 10) return; // 选框太小，忽略

        // 将屏幕坐标转换为世界坐标
        // 绘制时：translate(width/2 + offsetX, height/2 + offsetY) 然后 scale(zoom)
        // 所以屏幕坐标 (x, y) 对应的世界坐标：
        // worldX = (x - width/2 - offsetX) / zoom
        // worldY = (y - height/2 - offsetY) / zoom
        
        const centerX = width / 2;
        const centerY = height / 2;
        
        // 选中区域中心在屏幕坐标
        const selectCenterX = selectX + selectWidth / 2;
        const selectCenterY = selectY + selectHeight / 2;
        
        // 转换为世界坐标
        const worldSelectCenterX = (selectCenterX - centerX - this.offsetX) / this.zoom;
        const worldSelectCenterY = (selectCenterY - centerY - this.offsetY) / this.zoom;
        
        // 选中区域在世界坐标系中的大小
        const selectWorldWidth = selectWidth / this.zoom;
        const selectWorldHeight = selectHeight / this.zoom;

        // 计算新的缩放比例，使选中区域填满画布
        const padding = 20;
        const availableWidth = width - padding * 2;
        const availableHeight = height - padding * 2;
        const scaleX = availableWidth / selectWorldWidth;
        const scaleY = availableHeight / selectWorldHeight;
        const newZoom = Math.min(scaleX, scaleY);

        // 限制缩放范围
        this.zoom = Math.max(0.1, Math.min(1000, newZoom));

        // 调整偏移，使选中区域的世界坐标中心点居中显示
        // 新的offset应该使 worldSelectCenterX 在屏幕中心
        // centerX + newOffsetX + worldSelectCenterX * newZoom = centerX
        // 所以：newOffsetX = -worldSelectCenterX * newZoom
        this.offsetX = -worldSelectCenterX * this.zoom;
        this.offsetY = -worldSelectCenterY * this.zoom;

        this.draw();
        this.updateZoomDisplay();
    }

    /**
     * 绘制齿轮
     * @param {Object} gearData - 齿轮数据
     */
    drawGear(gearData) {
        this.gearData = gearData;
        this.draw();
    }

    /**
     * 绘制轮廓点
     * @param {Array<{x: number, y: number}>} profilePoints - 轮廓点数组
     */
    drawProfile(profilePoints) {
        this.profilePoints = profilePoints;
        this.draw();
    }

    draw() {
        const ctx = this.ctx;
        const width = this.canvas.width / this.dpr;
        const height = this.canvas.height / this.dpr;

        // 清空画布（使用实际canvas尺寸）
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // 设置变换
        ctx.save();
        ctx.translate(width / 2 + this.offsetX, height / 2 + this.offsetY);
        ctx.scale(this.zoom, this.zoom);

        // 绘制网格（如果有轮廓点，不绘制默认网格，由drawAxesWithScale绘制）
        if (!this.profilePoints || this.profilePoints.length === 0) {
            this.drawGrid(ctx, width, height);
        } else {
            // 只绘制背景网格，不绘制坐标轴（坐标轴由drawAxesWithScale绘制）
            this.drawBackgroundGrid(ctx, width, height);
        }

        // 如果有齿轮数据，绘制齿轮
        if (this.gearData) {
            this.drawGearGeometry(ctx, this.gearData);
        }

        // 如果有轮廓点，绘制轮廓（包含坐标轴刻度）
        if (this.profilePoints && this.profilePoints.length > 0) {
            this.drawProfilePoints(ctx, this.profilePoints);
        }

        ctx.restore();

        // 绘制选框（在屏幕坐标系中）
        if (this.isSelecting && this.selectStartX !== 0 && this.selectStartY !== 0) {
            this.drawSelectionBox(ctx);
        }

        // 调用绘制完成后的回调
        if (this.onAfterDraw && typeof this.onAfterDraw === 'function') {
            this.onAfterDraw();
        }
    }

    /**
     * 绘制选框
     */
    drawSelectionBox(ctx) {
        const x = Math.min(this.selectStartX, this.selectEndX);
        const y = Math.min(this.selectStartY, this.selectEndY);
        const width = Math.abs(this.selectEndX - this.selectStartX);
        const height = Math.abs(this.selectEndY - this.selectStartY);

        // 绘制选框边框
        ctx.strokeStyle = '#0066cc';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(x, y, width, height);
        ctx.setLineDash([]);

        // 绘制半透明填充
        ctx.fillStyle = 'rgba(0, 102, 204, 0.1)';
        ctx.fillRect(x, y, width, height);
    }

    drawGrid(ctx, width, height) {
        ctx.strokeStyle = '#e0e0e0';
        ctx.lineWidth = 0.5 / this.zoom;

        const gridSize = 20;
        const startX = -width / 2;
        const startY = -height / 2;
        const endX = width / 2;
        const endY = height / 2;

        // 垂直线
        for (let x = Math.floor(startX / gridSize) * gridSize; x <= endX; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, startY);
            ctx.lineTo(x, endY);
            ctx.stroke();
        }

        // 水平线
        for (let y = Math.floor(startY / gridSize) * gridSize; y <= endY; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(startX, y);
            ctx.lineTo(endX, y);
            ctx.stroke();
        }

        // 绘制坐标轴
        ctx.strokeStyle = '#999';
        ctx.lineWidth = 1 / this.zoom;
        ctx.beginPath();
        ctx.moveTo(startX, 0);
        ctx.lineTo(endX, 0);
        ctx.moveTo(0, startY);
        ctx.lineTo(0, endY);
        ctx.stroke();
    }

    drawBackgroundGrid(ctx, width, height) {
        ctx.strokeStyle = '#e0e0e0';
        ctx.lineWidth = 0.5 / this.zoom;

        const gridSize = 20;
        const startX = -width / 2;
        const startY = -height / 2;
        const endX = width / 2;
        const endY = height / 2;

        // 垂直线
        for (let x = Math.floor(startX / gridSize) * gridSize; x <= endX; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, startY);
            ctx.lineTo(x, endY);
            ctx.stroke();
        }

        // 水平线
        for (let y = Math.floor(startY / gridSize) * gridSize; y <= endY; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(startX, y);
            ctx.lineTo(endX, y);
            ctx.stroke();
        }
    }

    drawGearGeometry(ctx, gearData) {
        const {
            pitchDiameter,
            addendumDiameter,
            dedendumDiameter,
            baseDiameter,
            toothCount,
            module
        } = gearData;

        const centerX = 0;
        const centerY = 0;

        // 绘制齿根圆
        if (dedendumDiameter) {
            ctx.strokeStyle = '#ff6b6b';
            ctx.lineWidth = 2 / this.zoom;
            ctx.setLineDash([5 / this.zoom, 5 / this.zoom]);
            this.drawCircle(ctx, centerX, centerY, dedendumDiameter / 2);
            ctx.setLineDash([]);
        }

        // 绘制基圆
        if (baseDiameter) {
            ctx.strokeStyle = '#4ecdc4';
            ctx.lineWidth = 2 / this.zoom;
            ctx.setLineDash([3 / this.zoom, 3 / this.zoom]);
            this.drawCircle(ctx, centerX, centerY, baseDiameter / 2);
            ctx.setLineDash([]);
        }

        // 绘制分度圆
        if (pitchDiameter) {
            ctx.strokeStyle = '#45b7d1';
            ctx.lineWidth = 2.5 / this.zoom;
            this.drawCircle(ctx, centerX, centerY, pitchDiameter / 2);
        }

        // 绘制齿顶圆
        if (addendumDiameter) {
            ctx.strokeStyle = '#96ceb4';
            ctx.lineWidth = 2 / this.zoom;
            ctx.setLineDash([5 / this.zoom, 5 / this.zoom]);
            this.drawCircle(ctx, centerX, centerY, addendumDiameter / 2);
            ctx.setLineDash([]);
        }

        // 绘制齿轮齿形（简化版）
        if (toothCount && pitchDiameter) {
            this.drawGearTeeth(ctx, centerX, centerY, pitchDiameter / 2, 
                              addendumDiameter / 2, dedendumDiameter / 2, 
                              toothCount, baseDiameter / 2);
        }

        // 绘制中心点
        ctx.fillStyle = '#333';
        ctx.beginPath();
        ctx.arc(centerX, centerY, 3 / this.zoom, 0, 2 * Math.PI);
        ctx.fill();

        // 绘制标注
        this.drawLabels(ctx, gearData, centerX, centerY);
    }

    drawCircle(ctx, x, y, radius) {
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, 2 * Math.PI);
        ctx.stroke();
    }

    drawGearTeeth(ctx, centerX, centerY, pitchRadius, addendumRadius, 
                  dedendumRadius, toothCount, baseRadius) {
        ctx.strokeStyle = '#2c3e50';
        ctx.lineWidth = 1.5 / this.zoom;
        ctx.fillStyle = 'rgba(44, 62, 80, 0.1)';

        const angleStep = (2 * Math.PI) / toothCount;
        const points = [];

        // 生成齿形点
        for (let i = 0; i < toothCount; i++) {
            const angle = i * angleStep;
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);

            // 齿根点
            const dedX = centerX + dedendumRadius * cos;
            const dedY = centerY + dedendumRadius * sin;
            
            // 分度圆点
            const pitchX = centerX + pitchRadius * cos;
            const pitchY = centerY + pitchRadius * sin;
            
            // 齿顶点
            const addX = centerX + addendumRadius * cos;
            const addY = centerY + addendumRadius * sin;

            points.push({ x: dedX, y: dedY, type: 'dedendum' });
            points.push({ x: pitchX, y: pitchY, type: 'pitch' });
            points.push({ x: addX, y: addY, type: 'addendum' });
        }

        // 绘制齿形轮廓（简化）
        ctx.beginPath();
        for (let i = 0; i < points.length; i += 3) {
            const p = points[i];
            if (i === 0) {
                ctx.moveTo(p.x, p.y);
            } else {
                ctx.lineTo(p.x, p.y);
            }
        }
        ctx.closePath();
        ctx.stroke();
        ctx.fill();
    }

    drawLabels(ctx, gearData, centerX, centerY) {
        const { pitchDiameter, addendumDiameter, dedendumDiameter } = gearData;
        
        ctx.font = `${12 / this.zoom}px Arial`;
        ctx.fillStyle = '#333';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';

        // 标注分度圆
        if (pitchDiameter) {
            const labelX = centerX + pitchDiameter / 2 + 10 / this.zoom;
            const labelY = centerY;
            ctx.fillText(`分度圆: ${pitchDiameter.toFixed(2)}mm`, labelX, labelY);
        }
    }

    drawProfilePoints(ctx, profilePoints) {
        if (!profilePoints || profilePoints.length === 0) return;

        // 计算中心点（用于居中显示）
        const xs = profilePoints.map(p => p.x);
        const ys = profilePoints.map(p => p.y);
        const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
        const centerY = (Math.min(...ys) + Math.max(...ys)) / 2;

        // 保存中心点供其他方法使用
        this.profileCenterX = centerX;
        this.profileCenterY = centerY;

        // 绘制坐标轴刻度
        this.drawAxesWithScale(ctx, profilePoints, centerX, centerY);

        // 绘制轮廓点（不连线）
        ctx.fillStyle = '#e74c3c';
        profilePoints.forEach(point => {
            const x = point.x - centerX;
            const y = point.y - centerY;
            ctx.beginPath();
            ctx.arc(x, y, this.pointSize / this.zoom, 0, 2 * Math.PI);
            ctx.fill();
        });
    }

    drawAxesWithScale(ctx, profilePoints, centerX, centerY) {
        if (!profilePoints || profilePoints.length === 0) return;

        // 计算数据范围
        const xs = profilePoints.map(p => p.x - centerX);
        const ys = profilePoints.map(p => p.y - centerY);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        
        const rangeX = maxX - minX;
        const rangeY = maxY - minY;
        const maxRange = Math.max(rangeX, rangeY);

        // 计算合适的刻度间隔（根据数据范围自动调整）
        let scaleInterval = 1;
        if (maxRange > 100) {
            scaleInterval = 10;
        } else if (maxRange > 50) {
            scaleInterval = 5;
        } else if (maxRange > 20) {
            scaleInterval = 2;
        } else if (maxRange > 10) {
            scaleInterval = 1;
        } else if (maxRange > 5) {
            scaleInterval = 0.5;
        } else {
            scaleInterval = 0.1;
        }

        // 计算画布范围（用于绘制坐标轴）
        const canvasWidth = (this.canvas.width / this.dpr) / this.zoom;
        const canvasHeight = (this.canvas.height / this.dpr) / this.zoom;
        const axisLength = Math.max(canvasWidth, canvasHeight) * 0.6;

        // 绘制坐标轴
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 1.5 / this.zoom;
        ctx.beginPath();
        // X轴
        ctx.moveTo(-axisLength, 0);
        ctx.lineTo(axisLength, 0);
        // Y轴
        ctx.moveTo(0, -axisLength);
        ctx.lineTo(0, axisLength);
        ctx.stroke();

        // 绘制X轴刻度
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 1 / this.zoom;
        ctx.fillStyle = '#333';
        ctx.font = `${10 / this.zoom}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        // X轴刻度线
        const startX = Math.floor(minX / scaleInterval) * scaleInterval;
        const endX = Math.ceil(maxX / scaleInterval) * scaleInterval;
        for (let x = startX; x <= endX; x += scaleInterval) {
            const yPos = 0;
            const tickLength = 5 / this.zoom;
            
            ctx.beginPath();
            ctx.moveTo(x, yPos - tickLength);
            ctx.lineTo(x, yPos + tickLength);
            ctx.stroke();

            // 刻度标签（显示所有刻度，包括0）
            const label = x.toFixed(scaleInterval < 1 ? 1 : 0);
            ctx.fillText(label, x, yPos + tickLength + 2 / this.zoom);
        }

        // Y轴刻度线
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        const startY = Math.floor(minY / scaleInterval) * scaleInterval;
        const endY = Math.ceil(maxY / scaleInterval) * scaleInterval;
        for (let y = startY; y <= endY; y += scaleInterval) {
            const xPos = 0;
            const tickLength = 5 / this.zoom;
            
            ctx.beginPath();
            ctx.moveTo(xPos - tickLength, y);
            ctx.lineTo(xPos + tickLength, y);
            ctx.stroke();

            // 刻度标签（显示所有刻度，包括0）
            const label = y.toFixed(scaleInterval < 1 ? 1 : 0);
            ctx.fillText(label, xPos - tickLength - 2 / this.zoom, y);
        }

        // 绘制原点标记
        ctx.fillStyle = '#333';
        ctx.beginPath();
        ctx.arc(0, 0, 3 / this.zoom, 0, 2 * Math.PI);
        ctx.fill();
    }
}

// 导出供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GearVisualizer;
}

