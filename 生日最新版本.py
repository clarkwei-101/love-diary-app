import math
import platform
import random
import sys
import time
import tkinter as tk

WINDOW_W = 280
WINDOW_H = 80
NUM_WINDOWS = 96
NUM_POPUPS = 200 - NUM_WINDOWS  # Adjust to make total 200 windows
MOVE_STEP = 50

# 提示文字列表（已添加新内容）
TIPS = [
    '多喝水哦~', '保持微笑呀', '每天都要快快乐乐！',
    '记得吃我给你买的水果和零食', '吾妻尚年幼 怜语慰卿卿（熙熙）', '公主无臣仍是龙凤 家妻无我恐成枯骨', '想你了啦！！',
    '之后一定要办一个属于你的无人机表演', '拯救你多少次都行', '毕竟等我了9个月的答复 舍不得让你再等啦',
    '就说你容易忘记毕竟你可是富二代 军三代 官二代的大夫人', '別又背著我偷偷打遊戲喔', '有我在 没意外',
    '别熬夜', '忒忒（小狗）喜欢你', '圣诞快乐！！',
    '爱你 比昨天少一点 比明天多一点', '喂喂喂 毕竟你可是魏夫人', '此心已安，因为是你💝和你的春夏秋冬就是最完美的收益🎊',
    '行路不易，还好有你。💖和你在一起是我最棒的投资～🎉',
    '今天也要开心哦', '泡泡要抱抱！！', '一定有时候要笔直的出拳，比如我现在正在想',
    'call我呀',
    '说到喜欢 我从9月份就开始做局啦！！当时了解熙熙没有很多朋友 我就说我来做你的第一位朋友的时候～我就知道你会很感动～虽然看起来充满了算计和不道德 但还是想让你知道我到没那么好人',
    '我把我们在深圳玩的照片做成了一个短视频'
]

# 多样的背景颜色
BG_COLORS = [
    'lightpink', 'skyblue', 'lightgreen', 'lavender',
    'lightyellow', 'plum', 'coral', 'bisque',
    'aquamarine', 'mistyrose', 'honeydew',
    'lavenderblush', 'oldlace', 'lightcyan', 'peachpuff',
    'lightsteelblue', 'khaki', 'navajowhite'
]


# 配置参数
class Config:
    """温馨提示配置类"""
    FONT_SIZE = 14
    FONT_NAME = 'Arial'
    DURATION_MS = 400  # 窗口显示时长（毫秒）
    INTERVAL_MS = 400  # 窗口弹出间隔（毫秒）


SEQUENTIAL_DURATION_MS = 500  # 顺序中心弹窗的显示时长（毫秒），更快


def generate_heart_points(num_points, window_width, window_height):
    t_list = [2 * math.pi * i / num_points for i in range(num_points)]
    raw = [
        (16 * math.sin(t) ** 3, 13 * math.cos(t) - 5 * math.cos(2 * t)
         - 2 * math.cos(3 * t) - math.cos(4 * t)) for t in t_list
    ]
    xs = [p[0] for p in raw]
    ys = [p[1] for p in raw]
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)
    usable_w = SCREEN_W - window_width
    usable_h = SCREEN_H - window_height
    scale = min(usable_w / (max_x - min_x + 0.7), usable_h / (max_y - min_y + 0.8))
    heart_w = (max_x - min_x) * scale
    heart_h = (max_y - min_y) * scale
    base_x = (SCREEN_W - heart_w) // 2
    base_y = (SCREEN_H - heart_h) // 2
    mapped = []
    for x0, y0 in raw:
        nx = (x0 - min_x)
        ny = (y0 - min_y)
        px = int(base_x + nx * scale)
        py = int(base_y + heart_h - ny * scale)
        px = max(0, min(px, SCREEN_W - window_width))
        py = max(0, min(py, SCREEN_H - window_height))
        mapped.append((px, py))
    dedup = []
    seen = set()
    for p in mapped:
        if p not in seen:
            seen.add(p)
            dedup.append(p)
    return dedup[:num_points]


def move_window(win, end_x, end_y, callback, duration_ms=1000, steps=20):
    start_x = win.winfo_x()
    start_y = win.winfo_y()
    dx = end_x - start_x
    dy = end_y - start_y
    interval = duration_ms // steps
    step = 0

    def step_func():
        nonlocal step
        step += 1
        if step <= steps:
            new_x = start_x + dx * step / steps
            new_y = start_y + dy * step / steps
            win.geometry(f"{WINDOW_W}x{WINDOW_H}+{int(new_x)}+{int(new_y)}")
            win.after(interval, step_func)
        else:
            callback()

    step_func()


if __name__ == "__main__":
    root = tk.Tk()
    root.withdraw()
    sys_platform = platform.system()
    if sys_platform == 'Windows':
        import ctypes

        user32 = ctypes.windll.user32
        user32.SetProcessDPIAware()
        SCREEN_W = user32.GetSystemMetrics(0)
        SCREEN_H = user32.GetSystemMetrics(1)
    else:
        SCREEN_W = root.winfo_screenwidth()
        SCREEN_H = root.winfo_screenheight()

    center_x = (SCREEN_W - WINDOW_W) // 2
    center_y = (SCREEN_H - WINDOW_H) // 2
    points_heart = generate_heart_points(NUM_WINDOWS, WINDOW_W, WINDOW_H)
    if len(points_heart) < NUM_WINDOWS:
        points_heart += [points_heart[-1]] * (NUM_WINDOWS - len(points_heart))

    heart_windows = []
    all_windows = []
    pending_moves = 0

    # First, create windows in heart shape
    for idx, (x, y) in enumerate(points_heart):
        win = tk.Toplevel(root)
        win.title('温馨提示')
        win.geometry(f"{WINDOW_W}x{WINDOW_H}+{x}+{y}")
        win.resizable(False, False)
        win.attributes('-topmost', True)
        tip = random.choice(TIPS)
        bg = random.choice(BG_COLORS)
        label = tk.Label(
            win,
            text=tip,
            bg=bg,
            fg='#333333',
            font=(Config.FONT_NAME, Config.FONT_SIZE, 'bold'),
            wraplength=WINDOW_W - 20,
            padx=10,
            pady=10,
            justify=tk.CENTER
        )
        label.pack(fill=tk.BOTH, expand=True)
        heart_windows.append(win)
        all_windows.append(win)
        root.update()
        time.sleep(0.05)  # Slowed down the popup speed

    def create_tip(root: tk.Tk, x: int, y: int, tip=None) -> tk.Toplevel:
        try:
            win = tk.Toplevel(root)
            win.title('温馨提示')
            win.geometry(f"{WINDOW_W}x{WINDOW_H}+{x}+{y}")
            win.resizable(False, False)

            if tip is None:
                tip = random.choice(TIPS)
            bg = random.choice(BG_COLORS)

            label = tk.Label(
                win,
                text=tip,
                bg=bg,
                fg='#333333',
                font=(Config.FONT_NAME, Config.FONT_SIZE, 'bold'),
                wraplength=WINDOW_W - 20,
                padx=10,
                pady=10,
                justify=tk.CENTER
            )
            label.pack(fill=tk.BOTH, expand=True)

            win.attributes('-topmost', True)

            all_windows.append(win)
            return win
        except Exception as e:
            print(f"创建提示窗口出错: {e}", file=sys.stderr)
            return None


    def close_window_safely(win: tk.Tk) -> None:
        """安全关闭窗口"""
        try:
            if win.winfo_exists():
                win.destroy()
        except Exception as e:
            print(f"关闭窗口出错: {e}", file=sys.stderr)


    def gather_to_center():
        global pending_moves
        pending_moves = len(heart_windows)

        def move_callback():
            global pending_moves
            pending_moves -= 1
            if pending_moves == 0:
                # Close all heart windows first
                for win in heart_windows[:]:
                    close_window_safely(win)
                heart_windows.clear()
                # Wait 0.5 seconds then start sequential center popups
                root.after(500, create_sequential_center_popups)

        for win in heart_windows:
            move_window(win, center_x, center_y, move_callback)


    def create_sequential_center_popups():
        tips = list(TIPS)
        random.shuffle(tips)
        current_win = None
        index = 0
        num_sequential = len(tips)  # Use all unique tips for sequential

        def show_next():
            nonlocal current_win, index
            if current_win:
                close_window_safely(current_win)
            if index < num_sequential:
                tip = tips[index]
                current_win = create_tip(root, center_x, center_y, tip=tip)
                if current_win:
                    # Schedule next after SEQUENTIAL_DURATION_MS
                    root.after(SEQUENTIAL_DURATION_MS, show_next)
                index += 1
            else:
                # After all sequential, wait 0.5s then start random popups
                root.after(500, create_popups_random)

        show_next()


    def create_popups_random():
        points_random = []
        for _ in range(NUM_POPUPS):
            x = random.randint(0, SCREEN_W - WINDOW_W)
            y = random.randint(0, SCREEN_H - WINDOW_H)
            points_random.append((x, y))

        for i, (x, y) in enumerate(points_random):
            root.after(i * Config.INTERVAL_MS, lambda x=x, y=y: create_tip(root, x, y) and create_tip(root, x, y).after(Config.DURATION_MS, lambda: close_window_safely(create_tip(root, x, y))))

        for i, (x, y) in enumerate(points_random):
            root.after(i * Config.INTERVAL_MS, create_tip, root, x, y)

        # After all popups are scheduled, wait for the longest possible display time before quitting
        total_time = (NUM_POPUPS - 1) * Config.INTERVAL_MS + Config.DURATION_MS
        root.after(total_time + 1000, close_all)  # Add extra second


    def close_all():
        for w in all_windows:
            if w.winfo_exists():
                w.destroy()
        root.quit()


    # After showing heart for 1500ms, gather to center
    root.after(1500, gather_to_center)
    root.mainloop()
