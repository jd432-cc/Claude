;;; ==================================================================
;;;  BTSAnno.lsp
;;;  BTS Enterprise Standards Suite - annotation layer
;;;
;;;  BTSTEXTCHECK - text standards verification.
;;;
;;;  Only checks things that are unambiguously wrong. Text height is
;;;  judged on consistency rather than absolute size, because the plotted
;;;  size depends on the viewport scale and the annotation scale, neither
;;;  of which is knowable from the text object alone.
;;; ==================================================================

;;; ---- Layers text is allowed to live on. wcmatch, upper case.
(setq *BTS-TEXT-LAYERS* '("BTS-A-ANNO-*" "BTS-U-*-LABEL" "BTS-L-KEY"
                          "BTS-L-DRAFT"  "BTS-L-PAGEBLOCK" "BTS-L-NONPLOTTED"
                          "BTS-S-GRID"   "BTS-S-LEVELS"))

;;; ---- Approved text styles. Edit this to match the office template.
(setq *BTS-TEXT-STYLES* '("BTS-ANNOTATIVE" "BTS-STANDARD" "STANDARD"))

;;; ---- More distinct heights than this on one layer means somebody has
;;;      been typing sizes in by hand.
(setq *BTS-TEXT-MAX-HEIGHTS* 4)

(defun bts:text-layer-ok (lay / p hit)
  (foreach p *BTS-TEXT-LAYERS*
    (if (and (null hit) (wcmatch (strcase lay) p)) (setq hit T)))
  hit)

;;; (layer . (height-string ...)) accumulator.
(defun bts:height-note (lay h lst / hit hs)
  (setq hs (rtos h 2 3))
  (if (setq hit (assoc lay lst))
    (if (member hs (cdr hit))
      lst
      (subst (cons lay (cons hs (cdr hit))) hit lst))
    (cons (list lay hs) lst)))

;;; A style whose SHX cannot be resolved is silently substituted at plot
;;; time, which changes every character width on the sheet.
(defun bts:check-text-styles (/ n out nm fnt)
  (setq n (tblnext "STYLE" T))
  (while n
    (setq nm  (cdr (assoc 2 n))
          fnt (cond ((cdr (assoc 3 n))) (t "")))
    (if (and (wcmatch (strcase fnt) "*.SHX") (null (findfile fnt)))
      (setq out (cons (strcat "TXT-FONT|" nm "|cannot resolve " fnt) out)))
    (setq n (tblnext "STYLE")))
  (reverse out))

(defun bts:check-text (/ ss i en e ty lay sty tal heights tot out p)
  (setq tal '() heights '() tot 0 out '())
  (if (setq ss (ssget "_X" '((-4 . "<OR") (0 . "TEXT") (0 . "MTEXT")
                             (-4 . "OR>"))))
    (progn
      (setq i 0)
      (repeat (sslength ss)
        (setq en  (ssname ss i)
              e   (entget en)
              ty  (cdr (assoc 0 e))
              lay (cdr (assoc 8 e))
              sty (strcase (cond ((cdr (assoc 7 e))) (t "STANDARD")))
              tot (1+ tot))

        (if (not (bts:text-layer-ok lay))
          (setq tal (bts:tally (strcat "TXT-LAYER|" lay) tal)))

        (if (not (member sty *BTS-TEXT-STYLES*))
          (setq tal (bts:tally (strcat "TXT-STYLE|" sty) tal)))

        (if (= "" (bts:trim (bts:text-of e)))
          (setq tal (bts:tally (strcat "TXT-EMPTY|" lay) tal)))

        (if (cdr (assoc 40 e))
          (setq heights (bts:height-note lay (cdr (assoc 40 e)) heights)))

        ;; The remaining three are TEXT-only group codes. MTEXT carries its
        ;; equivalents inline and they are legitimate there.
        (if (= ty "TEXT")
          (progn
            (if (/= 0 (logand (cond ((cdr (assoc 71 e))) (t 0)) 6))
              (setq tal (bts:tally (strcat "TXT-MIRROR|" lay) tal)))
            (if (> (abs (- (cond ((cdr (assoc 41 e))) (t 1.0)) 1.0)) 0.01)
              (setq tal (bts:tally (strcat "TXT-WIDTH|" lay) tal)))
            (if (> (abs (cond ((cdr (assoc 51 e))) (t 0.0))) 0.001)
              (setq tal (bts:tally (strcat "TXT-OBLIQUE|" lay) tal)))))

        (setq i (1+ i)))))

  (setq out (bts:tally->findings tal "object(s)"))
  (foreach p heights
    (if (> (length (cdr p)) *BTS-TEXT-MAX-HEIGHTS*)
      (setq out (cons (strcat "TXT-HEIGHT|" (car p) "|"
                              (itoa (length (cdr p)))
                              " different text heights in use") out))))
  (setq out (append out (bts:check-text-styles)))
  (cons (strcat "INFO|text objects|" (itoa tot) " examined") out))

(defun C:BTSTEXTCHECK (/ iss i)
  (setq iss (bts:check-text))
  (bts:say (strcat "Text standards check - " (getvar "DWGNAME")))
  (bts:say "--------------------------------------------------------------")
  (foreach i iss (bts:say (strcat "  " (bts:fmt i))))
  (bts:say "--------------------------------------------------------------")
  (bts:say "  Approved styles are held in *BTS-TEXT-STYLES*.")
  (bts:say "  TXT-WIDTH and TXT-OBLIQUE are squashed or slanted TEXT -")
  (bts:say "  reset Width Factor to 1 and Obliquing to 0 in Properties.")
  (princ))

(bts:help-add '(
  ("BTSTEXTCHECK" "Text standards verification. Read only.")
  (""             "Style, layer, empty strings, mirrored or distorted text,")
  (""             "height consistency and unresolved SHX fonts.")
))

(princ)
