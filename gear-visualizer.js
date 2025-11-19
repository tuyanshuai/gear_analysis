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
        
        this.setupCanvas();
        this.setupEventListeners();
    }

    setupCanvas() {
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    resizeCanvas() {
        const container = this.canvas.parentElement;
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;
        this.draw();
    }

    setupEventListeners() {
        // 鼠标拖动
        this.canvas.addEventListener('mousedown', (e) => {
            this.isDragging = true;
            this.lastMouseX = e.clientX;
            this.lastMouseY = e.clientY;
        });

        this.canvas.addEventListener('mousemove', (e) => {
            if (this.isDragging) {
                const dx = e.clientX - this.lastMouseX;
                const dy = e.clientY - this.lastMouseY;
                this.offsetX += dx;
                this.offsetY += dy;
                this.lastMouseX = e.clientX;
                this.lastMouseY = e.clientY;
                this.draw();
            }
        });

        this.canvas.addEventListener('mouseup', () => {
            this.isDragging = false;
        });

        this.canvas.addEventListener('mouseleave', () => {
            this.isDragging = false;
        });

        // 鼠标滚轮缩放
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            this.zoom *= delta;
            this.zoom = Math.max(0.1, Math.min(10, this.zoom));
            this.draw();
            this.updateZoomDisplay();
        });
    }

    setZoom(zoom) {
        this.zoom = Math.max(0.1, Math.min(10, zoom));
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

    updateZoomDisplay() {
        const zoomDisplay = document.getElementById('zoomLevel');
        if (zoomDisplay) {
            zoomDisplay.textContent = this.zoom.toFixed(2) + 'x';
        }
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
        const width = this.canvas.width;
        const height = this.canvas.height;

        // 清空画布
        ctx.clearRect(0, 0, width, height);

        // 设置变换
        ctx.save();
        ctx.translate(width / 2 + this.offsetX, height / 2 + this.offsetY);
        ctx.scale(this.zoom, this.zoom);

        // 绘制网格
        this.drawGrid(ctx, width, height);

        // 如果有齿轮数据，绘制齿轮
        if (this.gearData) {
            this.drawGearGeometry(ctx, this.gearData);
        }

        // 如果有轮廓点，绘制轮廓
        if (this.profilePoints && this.profilePoints.length > 0) {
            this.drawProfilePoints(ctx, this.profilePoints);
        }

        ctx.restore();
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

        // 绘制轮廓线
        ctx.strokeStyle = '#e74c3c';
        ctx.lineWidth = 2 / this.zoom;
        ctx.beginPath();
        
        profilePoints.forEach((point, index) => {
            const x = point.x - centerX;
            const y = point.y - centerY;
            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        
        ctx.stroke();

        // 绘制轮廓点
        ctx.fillStyle = '#e74c3c';
        profilePoints.forEach(point => {
            const x = point.x - centerX;
            const y = point.y - centerY;
            ctx.beginPath();
            ctx.arc(x, y, 2 / this.zoom, 0, 2 * Math.PI);
            ctx.fill();
        });
    }
}

// 导出供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GearVisualizer;
}

