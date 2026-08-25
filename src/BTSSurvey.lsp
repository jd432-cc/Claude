;;; ==================================================================
;;;  BTSSurvey.lsp
;;;  BTS Enterprise Standards Suite - utility survey layer
;;;
;;;  BTSQLCHECK - PAS 128 quality level attribution.
;;;
;;;  A utility drawing that shows a run without saying how that run was
;;;  found is not a PAS 128 deliverable. This checks that every utility
;;;  carrying apparatus also carries a quality level, that the codes are
;;;  written in the form the standard defines, and that the PAS 128
;;;  statement is on the drawing at all.
;;; ==================================================================

;;; ---- Valid PAS 128 quality levels. Longest first: the scan takes the
;;;      first match at a position, so QL-B1P must be tried before QL-B1.
(setq *BTS-QL-CODES* '("QL-B1P" "QL-B2P" "QL-B3P" "QL-B4P"
                       "QL-B1"  "QL-B2"  "QL-B3"  "QL-B4"
                       "QL-A"   "QL-C"   "QL-D"))

;;; ---- Text that satisfies the standing PAS 128 statement requirement.
(setq *BTS-PAS128-TOKEN* "PAS 128")

(defun bts:ql-at (s i / hit c)
  (foreach c *BTS-QL-CODES*
    (if (and (null hit) (= c (substr s i (strlen c)))) (setq hit c)))
  hit)

;;; Returns (valid-codes . malformed-count). A "QL" that is not the start
;;; of a valid code is the interesting case - QLB2, QL B2, QL-E, QL2 are
;;; all things that turn up in inherited drawings and none of them are
;;; searchable by the client.
(defun bts:ql-scan (s / u i hit good bad)
  (setq u (strcase s) i 0 good '() bad 0)
  (while (setq i (vl-string-search "QL" u i))
    (if (setq hit (bts:ql-at u (1+ i)))
      (setq good (cons hit good) i (+ i (strlen hit)))
      (setq bad (1+ bad) i (+ i 2))))
  (cons (reverse good) bad))

(defun bts:text-on (lay / ss i out)
  (if (setq ss (ssget "_X" (list (cons 8 lay)
                                 '(-4 . "<OR") '(0 . "TEXT") '(0 . "MTEXT")
                                 '(-4 . "OR>"))))
    (progn
      (setq i 0)
      (repeat (sslength ss)
        (setq out (cons (bts:text-of (entget (ssname ss i))) out)
              i   (1+ i)))))
  (reverse out))

;;; The utility codes the register knows about, pulled from the
;;; BTS-U-<code>-Apparatus rows so this never drifts from the register.
(defun bts:utility-codes (/ out p nm)
  (foreach p *BTS-LAYERS*
    (setq nm (car p))
    (if (wcmatch (strcase nm) "BTS-U-*-APPARATUS")
      (setq out (cons (substr nm 7 (- (strlen nm) 16)) out))))
  (bts:uniq (reverse out)))

(defun bts:layer-populated (lay)
  (if (bts:lay-ent lay) (> (bts:count-on-layer lay) 0) nil))

(defun bts:check-ql (/ out allcodes badtotal uncoded r u lab s
                       own shared notes pas tal)
  (setq out '() allcodes '() badtotal 0 uncoded 0 tal '())

  ;; 1. Everything sitting on the QL layer should carry a code.
  (foreach s (bts:text-on "BTS-A-ANNO-QL")
    (setq r        (bts:ql-scan s)
          allcodes (append allcodes (car r))
          badtotal (+ badtotal (cdr r)))
    (if (null (car r)) (setq uncoded (1+ uncoded))))
  (if (> uncoded 0)
    (setq out (cons (strcat "QL-UNCODED|BTS-A-ANNO-QL|" (itoa uncoded)
                            " annotation(s) carry no recognised QL code")
                    out)))

  ;; 2. Near-miss codes anywhere in the annotation set.
  (foreach lab (cons "BTS-A-ANNO-Notes" (cons "BTS-A-ANNO-Text"
                     (mapcar '(lambda (u) (strcat "BTS-U-" u "-Label"))
                             (bts:utility-codes))))
    (foreach s (bts:text-on lab)
      (setq r        (bts:ql-scan s)
            allcodes (append allcodes (car r)))
      (if (> (cdr r) 0)
        (setq tal (bts:tally (strcat "QL-BAD|" lab) tal)))))
  (if (> badtotal 0)
    (setq out (cons (strcat "QL-BAD|BTS-A-ANNO-QL|" (itoa badtotal)
                            " malformed QL token(s)") out)))
  (setq out (append out (bts:tally->findings tal "malformed QL token(s)")))

  ;; 3. Every utility that actually has apparatus needs an attribution.
  ;;    Its own label layer is the right place for it; a drawing-wide note
  ;;    on the QL layer is accepted but flagged, because PAS 128 expects
  ;;    the level to vary run by run.
  (setq shared (if allcodes T nil))
  (foreach u (bts:utility-codes)
    (if (bts:layer-populated (strcat "BTS-U-" u "-Apparatus"))
      (progn
        (setq own nil)
        (foreach s (bts:text-on (strcat "BTS-U-" u "-Label"))
          (if (car (bts:ql-scan s)) (setq own T)))
        (cond
          (own nil)
          (shared
           (setq out (cons (strcat "QL-SHARED|BTS-U-" u "-Apparatus|apparatus"
                                   " present, no QL on its own label layer")
                           out)))
          (t
           (setq out (cons (strcat "QL-NONE|BTS-U-" u "-Apparatus|apparatus"
                                   " present with no quality level anywhere")
                           out)))))))

  ;; 4. The standing PAS 128 statement.
  (setq notes (append (bts:text-on "BTS-A-ANNO-Notes")
                      (bts:text-on "BTS-A-ANNO-Text"))
        pas   nil)
  (foreach s notes
    (if (vl-string-search *BTS-PAS128-TOKEN* (strcase s)) (setq pas T)))
  (if (null pas)
    (setq out (cons (strcat "QL-PAS128|BTS-A-ANNO-Notes|no PAS 128 statement"
                            " found in the standing notes") out)))

  (setq allcodes (bts:uniq allcodes))
  (if allcodes
    (setq out (cons (strcat "INFO|quality levels|"
                            (bts:join allcodes ", ")) out)))
  (reverse out))

(defun bts:join (lst sep / out first x)
  (setq out "" first T)
  (foreach x lst
    (setq out (if first (strcat out x) (strcat out sep x)) first nil))
  out)

(defun C:BTSQLCHECK (/ iss i)
  (setq iss (bts:check-ql))
  (bts:say (strcat "PAS 128 quality level check - " (getvar "DWGNAME")))
  (bts:say "--------------------------------------------------------------")
  (if (null iss)
    (bts:say "  Quality level attribution is complete.")
    (foreach i iss (bts:say (strcat "  " (bts:fmt i)))))
  (bts:say "--------------------------------------------------------------")
  (bts:say (strcat "  Valid codes: " (bts:join *BTS-QL-CODES* " ")))
  (princ))

(bts:help-add '(
  ("BTSQLCHECK"  "PAS 128 quality level attribution. Read only.")
  (""            "Checks codes are well formed, that every utility with")
  (""            "apparatus is attributed, and that the statement is present.")
))

(princ)
