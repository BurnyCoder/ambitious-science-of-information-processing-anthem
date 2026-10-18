"""anthem: Suno song + Remotion music video pipeline.

Local: package marker; re-exports the CLI entry point.
Global context: `uv run anthem` resolves to anthem.pipeline:main via pyproject [project.scripts].
"""

from anthem.pipeline import main  # console-script target

__all__ = ["main"]  # public API of the package
