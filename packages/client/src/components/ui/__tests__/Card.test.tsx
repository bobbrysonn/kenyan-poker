import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Card } from "../Card.js";

describe("Card", () => {
	it("renders rank and suit for a regular card", () => {
		render(<Card card={{ kind: "regular", suit: "hearts", rank: "K" }} />);
		expect(screen.getByLabelText("K of hearts")).toBeInTheDocument();
	});

	it("renders a joker with its color", () => {
		render(<Card card={{ kind: "joker", color: "red" }} />);
		expect(screen.getByLabelText("red Joker")).toBeInTheDocument();
		expect(screen.getAllByText("JOKER").length).toBeGreaterThan(0);
	});

	it("renders face-down without revealing the card", () => {
		render(<Card card={{ kind: "regular", suit: "spades", rank: "A" }} faceDown />);
		expect(screen.queryByLabelText("A of spades")).not.toBeInTheDocument();
		expect(screen.getByLabelText("Face-down card")).toBeInTheDocument();
	});

	it("calls onClick when legal and clickable", () => {
		const onClick = vi.fn();
		render(
			<Card card={{ kind: "regular", suit: "clubs", rank: "9" }} legal onClick={onClick} />,
		);
		fireEvent.click(screen.getByLabelText("9 of clubs"));
		expect(onClick).toHaveBeenCalledOnce();
	});

	it("is disabled and does not call onClick when illegal", () => {
		const onClick = vi.fn();
		render(
			<Card
				card={{ kind: "regular", suit: "diamonds", rank: "3" }}
				legal={false}
				onClick={onClick}
			/>,
		);
		const button = screen.getByLabelText("3 of diamonds") as HTMLButtonElement;
		expect(button).toBeDisabled();
		fireEvent.click(button);
		expect(onClick).not.toHaveBeenCalled();
	});
});
