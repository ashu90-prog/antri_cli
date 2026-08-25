import tkinter as tk
from tkinter import ttk
from tkinter import messagebox

class ToDoList:
    def __init__(self):
        self.window = tk.Tk()
        self.window.title("To-Do List App")
        self.window.geometry("300x200")

        self.tasks = []

        self.task_label = tk.Label(self.window, text="Task:")
        self.task_label.pack()

        self.task_entry = tk.Entry(self.window, width=30)
        self.task_entry.pack()

        self.add_button = tk.Button(self.window, text="Add Task", command=self.add_task)
        self.add_button.pack()

        self.tasks_list = tk.Listbox(self.window, width=40, height=10)
        self.tasks_list.pack()

        self.delete_button = tk.Button(self.window, text="Delete Task", command=self.delete_task)
        self.delete_button.pack()

    def add_task(self):
        task = self.task_entry.get()
        if task != "":
            self.tasks.append(task)
            self.tasks_list.insert(tk.END, task)
            self.task_entry.delete(0, tk.END)
        else:
            messagebox.showerror("Error", "Please enter a task")

    def delete_task(self):
        try:
            task_index = self.tasks_list.curselection()[0]
            self.tasks_list.delete(task_index)
            self.tasks.pop(task_index)
        except IndexError:
            messagebox.showerror("Error", "Please select a task to delete")

    def run(self):
        self.window.mainloop()

if __name__ == "__main__":
    app = ToDoList()
    app.run()