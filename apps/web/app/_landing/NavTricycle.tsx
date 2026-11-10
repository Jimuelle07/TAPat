"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import body from "./logo-tricycle.png";
import { applyBody, type Body, clearBody, type Drive, STEP, stepLaunch, stepPitch } from "./tricycle-physics";

// The nav logo (the home link) sits at the left of the pill's single row. On load it drives in once from behind the
// pill's left edge (the pill clips it) and brakes into its slot. A tiny simulation, not a keyframe curve: it enters at
// V0 and brakes at a constant deceleration until it stops; the body sits on a damped spring pushed by that
// deceleration, so the nose dips while braking and rocks back once before settling.
//
// Clicking "Open the app" drives it off to the right, behind the button and out past the pill's clipped edge, then
// navigates to /login.
//
// The ground shadow is a soft CSS contact shadow, not part of the image: it only slides with the
// tricycle and never tilts, so it stays on the ground. When the body pitches, the lifted end's wheel
// leaves the ground, so the shadow draws in toward the wheel still touching it and lightens a little.
const START_X = -92; // px: hidden behind the pill's edge at either logo size
const START_DELAY_MS = 250; // let the page settle so the entrance is seen
const BRAKE_MS = 1100;
const V0 = (2 * -START_X) / (BRAKE_MS / 1000); // px/s, so constant braking covers START_X exactly
const DECEL = V0 / (BRAKE_MS / 1000); // px/s²
const DIVE_DEG = 4; // steady nose-down pitch while braking
const LEAVE_MAX_MS = 900; // navigate by then even if the car has not cleared the pill

export function NavTricycle() {
  const router = useRouter();
  const car = useRef<HTMLAnchorElement>(null);
  const chassis = useRef<HTMLImageElement>(null);
  const ground = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = car.current;
    const bodyEl = chassis.current;
    const shadowEl = ground.current;
    const nav = el?.closest("nav");
    if (!el || bodyEl === null || shadowEl === null || !nav) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // x is the offset from the logo's laid-out slot at the row's left.
    const drive: Drive = { x: reduced ? 0 : START_X, v: reduced ? 0 : V0, pose: { pitch: 0, spin: 0 } as Body };
    let leaving = false; // "Open the app" was clicked: the car is driving off
    let last = 0;
    let carry = 0;
    let frame = 0;
    let startTimer = 0;
    let leaveTimer = 0;

    const place = () => {
      el.style.transform = `translateX(${drive.x.toFixed(2)}px)`;
      applyBody(bodyEl, shadowEl, drive.pose.pitch);
    };
    const reset = () => {
      el.style.transform = "";
      clearBody(bodyEl, shadowEl);
    };

    const brakeTick = (now: number) => {
      carry += Math.min((now - last) / 1000, 0.05); // cap a background-tab gap
      last = now;
      while (carry >= STEP) {
        carry -= STEP;
        const braking = drive.v > 0;
        if (braking) {
          drive.v = Math.max(0, drive.v - DECEL * STEP);
          drive.x = drive.v === 0 ? 0 : Math.min(0, drive.x + drive.v * STEP);
        }
        stepPitch(drive.pose, braking ? DIVE_DEG : 0, STEP);
      }
      place();
      if (drive.v === 0 && Math.abs(drive.pose.pitch) < 0.03 && Math.abs(drive.pose.spin) < 0.3) {
        reset();
        el.dataset.drive = "done";
        return;
      }
      frame = requestAnimationFrame(brakeTick);
    };

    // "Open the app": accelerate right from wherever the car is, behind the button, out past the clipped edge, then navigate.
    const leave = (href: string) => {
      leaving = true;
      window.clearTimeout(startTimer);
      cancelAnimationFrame(frame);
      el.dataset.drive = "done";
      const exit = nav.getBoundingClientRect().right - (el.getBoundingClientRect().left - drive.x);
      let gone = false;
      const go = () => {
        if (gone) return;
        gone = true;
        window.clearTimeout(leaveTimer);
        router.push(href);
      };
      leaveTimer = window.setTimeout(go, LEAVE_MAX_MS);
      last = 0;
      carry = 0;
      const launchTick = (now: number) => {
        if (last === 0) last = now;
        carry += Math.min((now - last) / 1000, 0.05);
        last = now;
        while (carry >= STEP) {
          carry -= STEP;
          stepLaunch(drive, STEP);
        }
        place();
        if (drive.x >= exit) {
          go();
          return;
        }
        frame = requestAnimationFrame(launchTick);
      };
      frame = requestAnimationFrame(launchTick);
    };

    const onClick = (e: MouseEvent) => {
      if (reduced || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target instanceof Element ? e.target.closest("a") : null;
      const href = a && nav.contains(a) ? a.getAttribute("href") : null;
      if (href !== "/login") return;
      e.preventDefault();
      e.stopPropagation(); // keep Next's own Link handler from navigating before the car is out
      if (!leaving) leave(href);
    };
    nav.addEventListener("click", onClick, true);

    if (reduced) {
      el.dataset.drive = "done";
    } else {
      startTimer = window.setTimeout(() => {
        el.dataset.drive = "running";
        frame = requestAnimationFrame((now) => {
          last = now;
          frame = requestAnimationFrame(brakeTick);
        });
      }, START_DELAY_MS);
    }

    // StrictMode remounts in dev; an unfinished brake-in goes back to parked rather than jumping to rest.
    return () => {
      window.clearTimeout(startTimer);
      window.clearTimeout(leaveTimer);
      cancelAnimationFrame(frame);
      nav.removeEventListener("click", onClick, true);
      reset();
      el.dataset.drive = reduced ? "done" : "pending";
    };
  }, [router]);

  return (
    // The home link, in the pill's row. Starts parked behind the pill's edge (CSS, so there is no flash before
    // hydration); the effect drives it in. It sits behind the row's links and button (-z-10 in the pill's own stacking
    // context), so a passing car never covers a label. The focus ring moves with it.
    <Link ref={car} href="/" prefetch={false} aria-label="TAPat" data-drive="pending" className="nav-tricycle relative -z-10 block">
      {/* Soft contact shadow under the wheelbase (tyres span ~9–97% of the image), centred on the ground line. */}
      <span
        ref={ground}
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -bottom-[3px] h-[6px] bg-[radial-gradient(ellipse_46%_50%_at_53%_50%,rgb(27_46_40/0.28),transparent)] lg:-bottom-[2px] lg:h-[5px]"
      />
      <Image ref={chassis} src={body} alt="" priority className="relative block h-11 w-auto lg:h-[30px]" />
    </Link>
  );
}
