import json
import os
import random
import tkinter as tk
from tkinter import messagebox, scrolledtext

class CardEditor:
    def __init__(self, root):
        self.root = root
        self.root.title("Drinking Game - Card Editor")
        self.root.geometry("900x700")
        self.root.configure(bg="#1e1e2e")

        self.file_path = os.path.abspath("cards/drink_cards.json")
        self.cards = []
        self.filtered_indices = []
        self.current_idx_in_filter = 0
        
        self.available_tags = [
            "sexo", "relações", "beber", "drama", "vergonha",
            "trabalho", "escola", "viagens", "família"
        ]
        self.active_filters = set()
        self.tag_vars = {}
        self.filter_vars = {}

        self.load_cards()
        self.setup_ui()
        self.apply_filter() # Initial filter (empty, means all)
        self.update_ui()

    def load_cards(self):
        try:
            with open(self.file_path, "r", encoding="utf-8") as f:
                self.cards = json.load(f)
        except Exception as e:
            messagebox.showerror("Erro", f"Não foi possível carregar as cartas: {e}")
            self.cards = []

    def save_cards(self):
        try:
            with open(self.file_path, "w", encoding="utf-8") as f:
                json.dump(self.cards, f, indent=4, ensure_ascii=False)
            self.refresh_stats()
        except Exception as e:
            messagebox.showerror("Erro", f"Não foi possível guardar as cartas: {e}")

    def setup_ui(self):
        # Colors
        bg = "#1e1e2e"
        sidebar_bg = "#181825"
        fg = "#cdd6f4"
        accent = "#89b4fa"
        danger = "#f38ba8"
        success = "#a6e3a1"

        # Sidebar / Filter & Stats
        self.sidebar = tk.Frame(self.root, width=250, bg=sidebar_bg, padx=15, pady=15)
        self.sidebar.pack(side="left", fill="y")

        # Stats Section
        tk.Label(self.sidebar, text="Estatísticas", bg=sidebar_bg, fg=accent, font=("Arial", 14, "bold")).pack(pady=(0, 10))
        self.total_label = tk.Label(self.sidebar, text="Total: 0", bg=sidebar_bg, fg=fg)
        self.total_label.pack(pady=2)
        
        self.stats_text = tk.Text(self.sidebar, bg=sidebar_bg, fg=fg, width=25, height=12, borderwidth=0, font=("Arial", 9))
        self.stats_text.pack(pady=5)
        self.stats_text.config(state="disabled")

        # Filter Section
        tk.Frame(self.sidebar, height=2, bg=accent, width=200).pack(pady=15)
        tk.Label(self.sidebar, text="Filtros 🔍", bg=sidebar_bg, fg=accent, font=("Arial", 14, "bold")).pack(pady=10)
        
        for tag in self.available_tags:
            var = tk.BooleanVar()
            cb = tk.Checkbutton(self.sidebar, text=tag, variable=var, bg=sidebar_bg, fg=fg, 
                                selectcolor="#11111b", activebackground=sidebar_bg, activeforeground=accent, 
                                command=self.apply_filter)
            cb.pack(anchor="w", padx=10)
            self.filter_vars[tag] = var

        tk.Button(self.sidebar, text="Limpar Filtros", command=self.clear_filters, bg="#313244", fg=fg).pack(pady=15, fill="x")

        # Main Content
        self.main_frame = tk.Frame(self.root, bg=bg, padx=30, pady=20)
        self.main_frame.pack(side="right", fill="both", expand=True)

        # Header
        self.header_frame = tk.Frame(self.main_frame, bg=bg)
        self.header_frame.pack(fill="x")

        tk.Label(self.header_frame, text="Drink Card Editor", font=("Arial", 24, "bold"), bg=bg, fg=fg).pack(side="left")
        self.index_label = tk.Label(self.header_frame, text="0 / 0", font=("Arial", 12), bg=bg, fg=accent)
        self.index_label.pack(side="right")

        # Card Content Area
        self.card_editor_frame = tk.Frame(self.main_frame, bg=bg)
        self.card_editor_frame.pack(fill="both", expand=True)

        # Card Text
        tk.Label(self.card_editor_frame, text="Texto da Carta", bg=bg, fg=fg, font=("Arial", 10, "bold")).pack(anchor="w", pady=(20, 5))
        self.card_text_widget = scrolledtext.ScrolledText(self.card_editor_frame, wrap=tk.WORD, height=6, bg="#313244", fg=fg, font=("Arial", 12), insertbackground=fg)
        self.card_text_widget.pack(fill="x", pady=5)
        self.card_text_widget.bind("<FocusOut>", lambda e: self.sync_data())

        # Drinks and Tags layout
        self.details_frame = tk.Frame(self.card_editor_frame, bg=bg)
        self.details_frame.pack(fill="x", pady=20)

        # Drinks
        self.drinks_frame = tk.Frame(self.details_frame, bg=bg)
        self.drinks_frame.pack(side="left", anchor="n")
        tk.Label(self.drinks_frame, text="Goles (Drinks)", bg=bg, fg=fg, font=("Arial", 10, "bold")).pack(anchor="w")
        self.drinks_val = tk.IntVar(value=1)
        self.drinks_spin = tk.Spinbox(self.drinks_frame, from_=1, to=10, textvariable=self.drinks_val, width=5, bg="#313244", fg=fg, font=("Arial", 12), command=self.sync_data)
        self.drinks_spin.pack(anchor="w", pady=5)

        # Card Tags (Tags for the current card)
        self.tags_frame = tk.Frame(self.details_frame, bg=bg, padx=40)
        self.tags_frame.pack(side="left", fill="both", expand=True)
        tk.Label(self.tags_frame, text="Tags da Carta", bg=bg, fg=fg, font=("Arial", 10, "bold")).pack(anchor="w")
        self.card_tags_grid = tk.Frame(self.tags_frame, bg=bg)
        self.card_tags_grid.pack(fill="x", pady=5)

        for i, tag in enumerate(self.available_tags):
            var = tk.BooleanVar()
            cb = tk.Checkbutton(self.card_tags_grid, text=tag, variable=var, bg=bg, fg=fg, 
                                selectcolor="#11111b", activebackground=bg, activeforeground=accent, 
                                command=self.sync_data)
            cb.grid(row=i // 3, column=i % 3, sticky="w", padx=5, pady=2)
            self.tag_vars[tag] = var

        # Buttons
        self.button_frame = tk.Frame(self.main_frame, bg=bg)
        self.button_frame.pack(side="bottom", fill="x", pady=20)

        self.btn_prev = tk.Button(self.button_frame, text="Anterior", command=self.prev_card, width=10, bg="#45475a", fg=fg)
        self.btn_prev.pack(side="left", padx=5)

        self.btn_next = tk.Button(self.button_frame, text="Próxima", command=self.next_card, width=10, bg="#45475a", fg=fg)
        self.btn_next.pack(side="left", padx=5)

        self.btn_random = tk.Button(self.button_frame, text="Random 🎲", command=self.random_card, width=12, bg=success, fg=bg, font=("Arial", 10, "bold"))
        self.btn_random.pack(side="left", padx=20)

        self.btn_delete = tk.Button(self.button_frame, text="Eliminar", command=self.delete_card, bg=danger, fg=bg, font=("Arial", 10, "bold"))
        self.btn_delete.pack(side="right", padx=5)

        self.btn_save = tk.Button(self.button_frame, text="Guardar Tudo", command=self.save_all, bg=accent, fg=bg, font=("Arial", 10, "bold"))
        self.btn_save.pack(side="right", padx=20)

    def apply_filter(self):
        self.active_filters = {tag for tag, var in self.filter_vars.items() if var.get()}
        
        if not self.active_filters:
            self.filtered_indices = list(range(len(self.cards)))
        else:
            self.filtered_indices = []
            for i, card in enumerate(self.cards):
                card_tags = set(card.get("tags", []))
                if self.active_filters.issubset(card_tags):
                    self.filtered_indices.append(i)
        
        self.current_idx_in_filter = 0
        self.update_ui()

    def clear_filters(self):
        for var in self.filter_vars.values():
            var.set(False)
        self.apply_filter()

    def sync_data(self):
        if not self.filtered_indices: return
        real_idx = self.filtered_indices[self.current_idx_in_filter]
        card = self.cards[real_idx]
        card["text"] = self.card_text_widget.get("1.0", tk.END).strip()
        card["drinks"] = self.drinks_val.get()
        card["tags"] = [tag for tag, var in self.tag_vars.items() if var.get()]

    def update_ui(self):
        if not self.filtered_indices:
            self.index_label.config(text="Filtro: 0 / 0")
            self.card_text_widget.delete("1.0", tk.END)
            self.card_text_widget.config(state="disabled")
            return
        
        self.card_text_widget.config(state="normal")
        real_idx = self.filtered_indices[self.current_idx_in_filter]
        card = self.cards[real_idx]
        
        self.index_label.config(text=f"Filtro: {self.current_idx_in_filter + 1} / {len(self.filtered_indices)} (Total: {len(self.cards)})")

        self.card_text_widget.delete("1.0", tk.END)
        self.card_text_widget.insert(tk.END, card.get("text", ""))

        self.drinks_val.set(card.get("drinks", 1))

        current_tags = card.get("tags", [])
        for tag, var in self.tag_vars.items():
            var.set(tag in current_tags)

        self.refresh_stats()

    def refresh_stats(self):
        total = len(self.cards)
        self.total_label.config(text=f"Total: {total}")

        tag_counts = {}
        for c in self.cards:
            for tag in c.get("tags", []):
                tag_counts[tag] = tag_counts.get(tag, 0) + 1

        self.stats_text.config(state="normal")
        self.stats_text.delete("1.0", tk.END)
        for tag, count in sorted(tag_counts.items(), key=lambda x: x[1], reverse=True):
            self.stats_text.insert(tk.END, f"{tag}: {count}\n")
        self.stats_text.config(state="disabled")

    def next_card(self):
        self.sync_data()
        if self.current_idx_in_filter < len(self.filtered_indices) - 1:
            self.current_idx_in_filter += 1
            self.update_ui()

    def prev_card(self):
        self.sync_data()
        if self.current_idx_in_filter > 0:
            self.current_idx_in_filter -= 1
            self.update_ui()

    def random_card(self):
        self.sync_data()
        if self.filtered_indices:
            self.current_idx_in_filter = random.randint(0, len(self.filtered_indices) - 1)
            self.update_ui()

    def delete_card(self):
        if not self.filtered_indices: return
        if messagebox.askyesno("Confirmar", "Tens a certeza que queres eliminar esta carta?"):
            real_idx = self.filtered_indices[self.current_idx_in_filter]
            del self.cards[real_idx]
            self.save_cards()
            self.apply_filter() # Recalculate filter as indices changed

    def save_all(self):
        self.sync_data()
        self.save_cards()
        messagebox.showinfo("Sucesso", "Todas as alterações foram guardadas no JSON!")

if __name__ == "__main__":
    root = tk.Tk()
    app = CardEditor(root)
    root.mainloop()
