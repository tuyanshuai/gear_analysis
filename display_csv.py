import csv
import matplotlib.pyplot as plt
import numpy as np
import sys

# 设置中文字体
plt.rcParams['font.sans-serif'] = ['SimHei', 'Microsoft YaHei', 'Arial Unicode MS']
plt.rcParams['axes.unicode_minus'] = False  # 解决负号显示问题

# 读取CSV文件
filename = '25-100刚轮-点.csv'
points = []

with open(filename, 'r', encoding='utf-8-sig') as f:  # 使用utf-8-sig自动处理BOM
    reader = csv.reader(f)
    for row in reader:
        if row:  # 跳过空行
            try:
                x, y, z = map(float, row)
                points.append([x, y, z])
            except ValueError:
                print(f"警告: 无法解析行: {row}")

# 转换为numpy数组
points = np.array(points)

# 打印基本信息
print(f"文件: {filename}")
print(f"总点数: {len(points)}")
print(f"X范围: [{points[:, 0].min():.6f}, {points[:, 0].max():.6f}]")
print(f"Y范围: [{points[:, 1].min():.6f}, {points[:, 1].max():.6f}]")
print(f"Z范围: [{points[:, 2].min():.6f}, {points[:, 2].max():.6f}]")
print(f"\n前5个点:")
for i in range(min(5, len(points))):
    print(f"  点{i+1}: ({points[i, 0]:.6f}, {points[i, 1]:.6f}, {points[i, 2]:.6f})")

# 点大小设置（可调节，默认更小）
point_size = 0.3  # 默认点大小（更小）
if len(sys.argv) > 1:
    try:
        point_size = float(sys.argv[1])
        print(f"使用点大小: {point_size}")
    except ValueError:
        print(f"警告: 无效的点大小参数 '{sys.argv[1]}', 使用默认值 {point_size}")

# 创建图形
fig = plt.figure(figsize=(12, 5))

# 2D视图 (XY平面)
ax1 = fig.add_subplot(121)
ax1.scatter(points[:, 0], points[:, 1], s=point_size, alpha=0.6, c='blue')
ax1.set_xlabel('X')
ax1.set_ylabel('Y')
ax1.set_title('XY平面视图')
ax1.grid(True, alpha=0.3)
ax1.set_aspect('equal', adjustable='box')

# 3D视图
ax2 = fig.add_subplot(122, projection='3d')
ax2.scatter(points[:, 0], points[:, 1], points[:, 2], s=point_size, alpha=0.6, c='red')
ax2.set_xlabel('X')
ax2.set_ylabel('Y')
ax2.set_zlabel('Z')
ax2.set_title('3D视图')

plt.tight_layout()
plt.show()

