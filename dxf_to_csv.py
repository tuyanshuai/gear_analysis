#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
DXF文件点数据提取工具
从DXF文件中提取所有POINT实体并转换为CSV格式
"""

import re
import csv
import sys
import math

def transform_point(x, y, z, insert_x, insert_y, insert_z, scale_x, scale_y, scale_z, rotation_deg):
    """
    对点应用INSERT变换（平移、缩放、旋转）
    
    参数:
        x, y, z: 原始点坐标
        insert_x, insert_y, insert_z: INSERT插入点
        scale_x, scale_y, scale_z: 缩放因子
        rotation_deg: 旋转角度（度）
    
    返回:
        变换后的点坐标 (x, y, z)
    """
    # 应用缩放
    x_scaled = x * scale_x
    y_scaled = y * scale_y
    z_scaled = z * scale_z
    
    # 应用旋转（绕Z轴，在XY平面内）
    if rotation_deg != 0:
        rotation_rad = math.radians(rotation_deg)
        cos_r = math.cos(rotation_rad)
        sin_r = math.sin(rotation_rad)
        x_rotated = x_scaled * cos_r - y_scaled * sin_r
        y_rotated = x_scaled * sin_r + y_scaled * cos_r
    else:
        x_rotated = x_scaled
        y_rotated = y_scaled
    
    # 应用平移
    x_final = x_rotated + insert_x
    y_final = y_rotated + insert_y
    z_final = z_scaled + insert_z
    
    return (x_final, y_final, z_final)

def parse_dxf_points(dxf_file_path):
    """
    解析DXF文件，提取所有POINT实体的坐标
    包括BLOCK定义中的点和INSERT实体引用的点（应用变换后）
    
    参数:
        dxf_file_path: DXF文件路径
    
    返回:
        points: 点坐标列表，每个点为(x, y, z)元组
    """
    points = []
    
    try:
        with open(dxf_file_path, 'r', encoding='utf-8', errors='ignore') as f:
            lines = f.readlines()
    except Exception as e:
        print(f"读取文件时出错: {e}")
        return points
    
    # 第一步：提取所有BLOCK定义中的POINT
    blocks = {}  # {block_name: [points]}
    inserts = []  # [(block_name, insert_x, insert_y, insert_z, scale_x, scale_y, scale_z, rotation)]
    
    i = 0
    current_block = None
    current_block_points = []
    
    while i < len(lines):
        line = lines[i].strip()
        
        # 查找BLOCK定义开始
        if line == 'BLOCK':
            current_block = None
            current_block_points = []
            i += 1
            # 读取BLOCK名称（组码2）
            while i < len(lines):
                code_line = lines[i].strip()
                i += 1
                if code_line == '0':
                    i -= 1
                    break
                try:
                    code = int(code_line)
                except ValueError:
                    continue
                if i >= len(lines):
                    break
                value_line = lines[i].strip()
                i += 1
                if code == 2:  # BLOCK名称
                    current_block = value_line
                    break
            continue
        
        # 查找BLOCK定义结束
        if line == 'ENDBLK':
            if current_block and current_block_points:
                blocks[current_block] = current_block_points
            current_block = None
            current_block_points = []
            i += 1
            continue
        
        # 在BLOCK中查找POINT实体
        if line == 'POINT':
            point_data = {}
            i += 1
            point_complete = False
            
            while i < len(lines):
                code_line = lines[i].strip()
                
                if code_line == '0':
                    if 'x' in point_data and 'y' in point_data:
                        x = point_data['x']
                        y = point_data['y']
                        z = point_data.get('z', 0.0)
                        if current_block is not None:
                            current_block_points.append((x, y, z))
                        else:
                            # 不在BLOCK中的POINT（直接添加到结果）
                            points.append((x, y, z))
                        point_complete = True
                    break
                
                try:
                    code = int(code_line)
                except ValueError:
                    i += 1
                    continue
                
                i += 1
                if i >= len(lines):
                    break
                
                value_line = lines[i].strip()
                i += 1
                
                if code == 10:
                    try:
                        point_data['x'] = float(value_line)
                    except ValueError:
                        pass
                elif code == 20:
                    try:
                        point_data['y'] = float(value_line)
                    except ValueError:
                        pass
                elif code == 30:
                    try:
                        point_data['z'] = float(value_line)
                    except ValueError:
                        pass
            
            if not point_complete and 'x' in point_data and 'y' in point_data:
                x = point_data['x']
                y = point_data['y']
                z = point_data.get('z', 0.0)
                if current_block is not None:
                    current_block_points.append((x, y, z))
                else:
                    points.append((x, y, z))
            continue
        
        # 查找INSERT实体
        if line == 'INSERT':
            block_name = ''
            insert_x = 0
            insert_y = 0
            insert_z = 0
            scale_x = 1.0
            scale_y = 1.0
            scale_z = 1.0
            rotation = 0.0
            i += 1
            
            while i < len(lines):
                code_line = lines[i].strip()
                i += 1
                if code_line == '0':
                    i -= 1
                    break
                try:
                    code = int(code_line)
                except ValueError:
                    continue
                if i >= len(lines):
                    break
                value_line = lines[i].strip()
                i += 1
                
                if code == 2:
                    block_name = value_line
                elif code == 10:
                    try:
                        insert_x = float(value_line)
                    except ValueError:
                        pass
                elif code == 20:
                    try:
                        insert_y = float(value_line)
                    except ValueError:
                        pass
                elif code == 30:
                    try:
                        insert_z = float(value_line)
                    except ValueError:
                        pass
                elif code == 41:
                    try:
                        scale_x = float(value_line)
                    except ValueError:
                        pass
                elif code == 42:
                    try:
                        scale_y = float(value_line)
                    except ValueError:
                        pass
                elif code == 43:
                    try:
                        scale_z = float(value_line)
                    except ValueError:
                        pass
                elif code == 50:
                    try:
                        rotation = float(value_line)
                    except ValueError:
                        pass
            
            if block_name:
                inserts.append((block_name, insert_x, insert_y, insert_z, scale_x, scale_y, scale_z, rotation))
            continue
        
        i += 1
    
    # 保存BLOCK定义
    if current_block and current_block_points:
        blocks[current_block] = current_block_points
    
    # 第二步：对每个INSERT应用变换
    for block_name, insert_x, insert_y, insert_z, scale_x, scale_y, scale_z, rotation in inserts:
        if block_name in blocks:
            for x, y, z in blocks[block_name]:
                transformed = transform_point(x, y, z, insert_x, insert_y, insert_z, 
                                               scale_x, scale_y, scale_z, rotation)
                points.append(transformed)
        else:
            print(f"警告: 未找到BLOCK定义 '{block_name}'")
    
    return points

def save_points_to_csv(points, csv_file_path):
    """
    将点数据保存为CSV文件
    
    参数:
        points: 点坐标列表
        csv_file_path: 输出CSV文件路径
    """
    try:
        with open(csv_file_path, 'w', newline='', encoding='utf-8-sig') as f:
            writer = csv.writer(f)
            # 写入表头
            writer.writerow(['X', 'Y', 'Z'])
            # 写入点数据
            for point in points:
                writer.writerow(point)
        print(f"成功提取 {len(points)} 个点，已保存到: {csv_file_path}")
    except Exception as e:
        print(f"保存CSV文件时出错: {e}")

def main():
    # 输入和输出文件路径
    dxf_file = '25-100刚轮-点.dxf'
    csv_file = '25-100刚轮-点.csv'
    
    # 是否去重（可以通过命令行参数控制）
    remove_duplicates = False
    if len(sys.argv) > 1 and sys.argv[1] in ['--unique', '-u']:
        remove_duplicates = True
    
    print(f"正在解析DXF文件: {dxf_file}")
    points = parse_dxf_points(dxf_file)
    
    if points:
        unique_points = set(points)
        print(f"找到 {len(points)} 个点（包括重复）")
        print(f"唯一点数量: {len(unique_points)}")
        if len(points) != len(unique_points):
            print(f"重复点数量: {len(points) - len(unique_points)}")
        print(f"（已处理INSERT实体的变换：平移、缩放、旋转）")
        
        # 如果启用去重，只保存唯一点
        if remove_duplicates:
            # 保持原始顺序（按首次出现顺序）
            seen = set()
            points_ordered = []
            for p in points:
                if p not in seen:
                    seen.add(p)
                    points_ordered.append(p)
            points = points_ordered
            csv_file = csv_file.replace('.csv', '_unique.csv')
            print(f"已启用去重，将保存 {len(points)} 个唯一点")
        
        save_points_to_csv(points, csv_file)
    else:
        print("未找到任何点数据")

if __name__ == '__main__':
    main()
