"""Stepping forward should move one statement at a time, like a debugger."""
import importlib
import sys
import tempfile
import textwrap
import unittest
from pathlib import Path

from edtrace.execute import execute

LECTURE = '''
from edtrace import text


def main():
    numbers = [  # @inspect numbers
        1,
        2,
    ]
    total = sum(n * n for n in numbers)  # @inspect total
    text("one statement "
         "on two lines")
    with open(__file__) as f:
        first = f.readline()
    helper()
    after = 1


def helper():
    x = 2  # @inspect x
'''


def trace_lines(source: str) -> list[tuple[str, int]]:
    """(function, line) of each step when tracing `source` as a lecture."""
    with tempfile.TemporaryDirectory() as directory:
        path = Path(directory) / "tiny_lecture.py"
        path.write_text(textwrap.dedent(source).lstrip())
        sys.path.insert(0, directory)
        try:
            trace = execute(module_name="tiny_lecture", inspect_all_variables=False)
        finally:
            sys.path.remove(directory)
            sys.modules.pop("tiny_lecture", None)
            importlib.invalidate_caches()
    return trace, [(step.stack[-1].function_name, step.stack[-1].line_number) for step in trace.steps]


class TestStepping(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.trace, cls.lines = trace_lines(LECTURE)

    def test_one_step_per_statement(self):
        self.assertEqual(self.lines, [
            ("main", 4),    # def main():
            ("main", 5),    # numbers = [ ... ] (lines 5-8, one step)
            ("main", 9),    # total = sum(...) (the generator expression isn't stepped into)
            ("main", 10),   # text(...) (lines 10-11, one step)
            ("main", 12),   # with open(...) as f:
            ("main", 13),   # first = f.readline() (leaving the with block isn't a step)
            ("main", 14),   # helper()
            ("helper", 18),  # def helper():
            ("helper", 19),  # x = 2
            ("main", 15),   # after = 1 (no extra step back at helper(), which shows nothing)
        ])

    def test_inspect_on_multi_line_statement(self):
        envs = {step.stack[-1].line_number: step.env for step in self.trace.steps}
        self.assertEqual([v.contents for v in envs[5]["numbers"].contents], [1, 2])
        self.assertEqual(envs[9]["total"].contents, 5)

    def test_renderings_of_a_multi_line_statement_stay_together(self):
        renderings = [r for step in self.trace.steps if step.stack[-1].line_number == 10 for r in step.renderings]
        self.assertEqual([r.data for r in renderings], ["one statement on two lines"])


if __name__ == "__main__":
    unittest.main()
